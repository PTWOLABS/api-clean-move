import {
  Establishment as PrismaEstablishment,
  Prisma,
} from "../../../../generated/prisma/client";
import { Establishment } from "../../../../modules/establishments/domain/entities/establishment";
import { Cnpj } from "../../../../modules/establishments/domain/value-objects/cnpj";
import { OperatingHours } from "../../../../modules/establishments/domain/value-objects/operating-hours";
import { Slug } from "../../../../modules/establishments/domain/value-objects/slug";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { operatingHoursSchema } from "../../../http/controllers/register-establishment.controller";

export class PrismaEstablishmentMapper {
  static toDomain(raw: PrismaEstablishment): Establishment {
    const operatingHours = operatingHoursSchema.parse(raw.operatingHours);

    return Establishment.restore(
      {
        ownerId: new UniqueEntityId(raw.ownerId),
        corporateName: raw.corporateName,
        socialReason: raw.socialReason,
        cnpj: Cnpj.create(raw.cnpj),
        operatingHours: OperatingHours.create(operatingHours),
        slug: Slug.create(raw.slug),
        profileImageUrl: raw.profileImageUrl,
        bannerImageUrl: raw.bannerImageUrl,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(
    raw: Establishment,
  ): Prisma.EstablishmentUncheckedCreateInput {
    const operatingHours = {
      days: raw.operatingHours.days,
    } satisfies Prisma.InputJsonObject;

    return {
      id: raw.id.toString(),
      ownerId: raw.ownerId.toString(),
      corporateName: raw.corporateName,
      socialReason: raw.socialReason,
      cnpj: raw.cnpj.value,
      slug: raw.slug.value,
      operatingHours,
      profileImageUrl: raw.profileImageUrl,
      bannerImageUrl: raw.bannerImageUrl,
    };
  }

  static toPrismaUpdate(
    raw: Establishment,
  ): Prisma.EstablishmentUncheckedUpdateInput {
    const operatingHours = {
      days: raw.operatingHours.days,
    } satisfies Prisma.InputJsonObject;

    return {
      corporateName: raw.corporateName,
      socialReason: raw.socialReason,
      cnpj: raw.cnpj.value,
      slug: raw.slug.value,
      operatingHours,
      profileImageUrl: raw.profileImageUrl,
      bannerImageUrl: raw.bannerImageUrl,
    };
  }
}
