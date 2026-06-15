import {
  Establishment as PrismaEstablishment,
  Prisma,
} from "../../../../generated/prisma/client";
import { Establishment } from "../../../../modules/establishments/domain/entities/establishment";
import { Cnpj } from "../../../../modules/establishments/domain/value-objects/cnpj";
import { Slug } from "../../../../modules/establishments/domain/value-objects/slug";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaEstablishmentMapper {
  static toDomain(raw: PrismaEstablishment): Establishment {
    return Establishment.restore(
      {
        ownerId: new UniqueEntityId(raw.ownerId),
        tradeName: raw.tradeName,
        legalBusinessName: raw.legalBusinessName,
        cnpj: raw.cnpj !== null ? Cnpj.create(raw.cnpj) : null,
        slug: raw.slug !== null ? Slug.create(raw.slug) : null,
        bannerImageUrl: raw.bannerImageUrl,
        onboardingCompletedAt: raw.onboardingCompletedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(
    raw: Establishment,
  ): Prisma.EstablishmentUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      ownerId: raw.ownerId.toString(),
      tradeName: raw.tradeName,
      legalBusinessName: raw.legalBusinessName,
      cnpj: raw.cnpj?.value ?? null,
      slug: raw.slug?.value ?? null,
      bannerImageUrl: raw.bannerImageUrl,
      onboardingCompletedAt: raw.onboardingCompletedAt,
    };
  }

  static toPrismaUpdate(
    raw: Establishment,
  ): Prisma.EstablishmentUncheckedUpdateInput {
    return {
      tradeName: raw.tradeName,
      legalBusinessName: raw.legalBusinessName,
      cnpj: raw.cnpj?.value ?? null,
      slug: raw.slug?.value ?? null,
      bannerImageUrl: raw.bannerImageUrl,
      onboardingCompletedAt: raw.onboardingCompletedAt,
    };
  }
}
