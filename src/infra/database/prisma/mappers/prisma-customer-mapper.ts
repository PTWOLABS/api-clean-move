import {
  Customer as PrismaCustomer,
  Prisma,
} from "../../../../generated/prisma/client";
import {
  Address,
  AddressProps,
} from "../../../../modules/accounts/domain/value-objects/address";
import { Email } from "../../../../modules/accounts/domain/value-objects/email";
import { Phone } from "../../../../modules/accounts/domain/value-objects/phone";
import { Customer } from "../../../../modules/customer/domain/entities/customer";
import { CustomerDocument } from "../../../../modules/customer/domain/value-objects/customer-document";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export class PrismaCustomerMapper {
  static toDomain(raw: PrismaCustomer): Customer {
    return Customer.create(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        profileImageUrl: raw.profileImageUrl,
        cpfCnpj: raw.cpfCnpj ? CustomerDocument.create(raw.cpfCnpj) : null,
        fullName: raw.fullName,
        phone: Phone.create(raw.phone),
        email: new Email(raw.email),
        address: this.toAddress(raw.address),
        birthDate: raw.birthDate,
        nickname: raw.nickname,
        deletedAt: raw.deletedAt,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(raw: Customer): Prisma.CustomerUncheckedCreateInput {
    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      profileImageUrl: raw.profileImageUrl,
      cpfCnpj: raw.cpfCnpj?.toString() ?? null,
      fullName: raw.fullName,
      phone: raw.phone.toString(),
      email: raw.email.toString(),
      address: this.toPrismaAddress(raw.address),
      birthDate: raw.birthDate,
      nickname: raw.nickname,
      deletedAt: raw.deletedAt,
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  static toPrismaUpdate(raw: Customer): Prisma.CustomerUncheckedUpdateInput {
    return {
      profileImageUrl: raw.profileImageUrl,
      cpfCnpj: raw.cpfCnpj?.toString() ?? null,
      fullName: raw.fullName,
      phone: raw.phone.toString(),
      email: raw.email.toString(),
      address: this.toPrismaAddress(raw.address),
      birthDate: raw.birthDate,
      nickname: raw.nickname,
      deletedAt: raw.deletedAt,
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  private static toPrismaAddress(
    address: Address | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (!address) {
      return Prisma.JsonNull;
    }

    return {
      street: address.street,
      country: address.country,
      state: address.state,
      zipCode: address.zipCode,
      city: address.city,
    };
  }

  private static toAddress(raw: Prisma.JsonValue | null): Address | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }

    const value = raw as Record<keyof AddressProps, string>;

    return Address.create({
      street: value.street,
      country: value.country,
      state: value.state,
      zipCode: value.zipCode,
      city: value.city,
    });
  }
}
