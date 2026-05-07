import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { CustomerAlreadyDeletedError } from "../errors/customer-already-deleted-error";
import { InvalidCustomerInputError } from "../errors/invalid-customer-input-error";
import { CustomerDocument } from "../value-objects/customer-document";

export type CustomerProps = {
  establishmentId: UniqueEntityId;
  profileImageUrl: string | null;
  cpfCnpj: CustomerDocument | null;
  fullName: string;
  phone: Phone;
  email: Email;
  address: Address | null;
  birthDate: Date | null;
  nickname: string | null;
  deletedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type CustomerCreateProps = Optional<
  Omit<CustomerProps, "cpfCnpj"> & {
    cpfCnpj: CustomerDocument | string | null;
  },
  "createdAt" | "updatedAt" | "deletedAt" | "profileImageUrl"
>;

export class Customer extends AggregateRoot<CustomerProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get cpfCnpj() {
    return this.props.cpfCnpj;
  }

  get profileImageUrl() {
    return this.props.profileImageUrl;
  }

  get fullName() {
    return this.props.fullName;
  }

  get phone() {
    return this.props.phone;
  }

  get email() {
    return this.props.email;
  }

  get address() {
    return this.props.address;
  }

  get birthDate() {
    return this.props.birthDate;
  }

  get nickname() {
    return this.props.nickname;
  }

  get deletedAt() {
    return this.props.deletedAt;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  static create(props: CustomerCreateProps, id?: UniqueEntityId) {
    const customer = new Customer(
      {
        ...props,
        profileImageUrl: Customer.normalizeOptionalText(props.profileImageUrl),
        cpfCnpj: Customer.normalizeCpfCnpj(props.cpfCnpj),
        fullName: Customer.normalizeRequiredText(props.fullName, "fullName"),
        nickname: Customer.normalizeOptionalText(props.nickname),
        deletedAt: props.deletedAt ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );

    return customer;
  }

  update(data: {
    profileImageUrl?: string | null;
    cpfCnpj?: CustomerDocument | string | null;
    fullName?: string;
    phone?: Phone;
    email?: Email;
    address?: Address | null;
    birthDate?: Date | null;
    nickname?: string | null;
  }) {
    if (this.isDeleted()) {
      throw new CustomerAlreadyDeletedError();
    }

    if (data.cpfCnpj !== undefined) {
      this.props.cpfCnpj = Customer.normalizeCpfCnpj(data.cpfCnpj);
    }

    if (data.profileImageUrl !== undefined) {
      this.props.profileImageUrl = Customer.normalizeOptionalText(
        data.profileImageUrl,
      );
    }

    if (data.fullName !== undefined) {
      this.props.fullName = Customer.normalizeRequiredText(
        data.fullName,
        "fullName",
      );
    }

    if (data.phone !== undefined) {
      this.props.phone = data.phone;
    }

    if (data.email !== undefined) {
      this.props.email = data.email;
    }

    if (data.address !== undefined) {
      this.props.address = data.address;
    }

    if (data.birthDate !== undefined) {
      this.props.birthDate = data.birthDate;
    }

    if (data.nickname !== undefined) {
      this.props.nickname = Customer.normalizeOptionalText(data.nickname);
    }

    this.touch();
  }

  softDelete(referenceDate: Date = new Date()) {
    if (this.isDeleted()) {
      throw new CustomerAlreadyDeletedError();
    }

    this.props.deletedAt = referenceDate;
    this.touch();
  }

  isDeleted() {
    return this.props.deletedAt !== null;
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  private static normalizeCpfCnpj(value: CustomerDocument | string | null) {
    if (value === null) {
      return null;
    }

    if (value instanceof CustomerDocument) {
      return value;
    }

    if (!value.trim()) {
      return null;
    }

    return CustomerDocument.create(value);
  }

  private static normalizeRequiredText(value: string, field: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new InvalidCustomerInputError(`${field} is required.`);
    }

    return normalized;
  }

  private static normalizeOptionalText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }
}
