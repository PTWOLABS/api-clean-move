import {
  Establishment,
  EstablishmentProps,
} from "../../src/modules/establishments/domain/entities/establishment";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";
import { Cnpj } from "../../src/modules/establishments/domain/value-objects/cnpj";
import {
  makeCompanyName,
  makeUsername,
  randomIntInclusive,
} from "./random-data";
import { PrismaService } from "../../src/infra/database/prisma/prisma.service";
import { PrismaEstablishmentMapper } from "../../src/infra/database/prisma/mappers/prisma-establishment-mapper";

function calculateCnpjCheckDigit(numbers: number[], weights: number[]) {
  const total = numbers.reduce((sum, number, index) => {
    const weight = weights[index];

    if (weight === undefined) {
      throw new Error(`Missing weight for index ${index}`);
    }

    return sum + number * weight;
  }, 0);
  const remainder = total % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

function makeValidCnpj() {
  let base = "";

  do {
    base = Array.from({ length: 12 }, () => randomIntInclusive(0, 9)).join("");
  } while (/^(\d)\1+$/.test(base));

  const baseDigits = base.split("").map(Number);
  const firstCheckDigit = calculateCnpjCheckDigit(
    baseDigits,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const secondCheckDigit = calculateCnpjCheckDigit(
    [...baseDigits, firstCheckDigit],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );

  return `${base}${firstCheckDigit}${secondCheckDigit}`;
}

export function makeEstablishment(
  override?: Partial<EstablishmentProps>,
  id?: UniqueEntityId,
) {
  const establishment = Establishment.create(
    {
      ownerId: new UniqueEntityId(),
      cnpj: Cnpj.create(makeValidCnpj()),
      legalBusinessName: makeCompanyName(),
      tradeName: makeUsername(),
      ...override,
    },
    id,
  );

  return establishment;
}

export class EstablishmentFactory {
  constructor(private prisma: PrismaService) {}

  async makePrismaEstablishment(
    data?: Partial<EstablishmentProps>,
    id?: UniqueEntityId,
  ) {
    const establishment = makeEstablishment(data, id);

    await this.prisma.establishment.create({
      data: PrismaEstablishmentMapper.toPrisma(establishment),
    });

    return establishment;
  }
}
