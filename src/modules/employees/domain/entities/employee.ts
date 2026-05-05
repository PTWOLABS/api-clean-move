import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cpf } from "../../../accounts/domain/value-objects/cpf";
import { InvalidRegisterEmployeeInputError } from "../errors/invalid-register-employee-input-error";
import {
  EmployeeFeature,
  EmployeeFeaturesPolicy,
} from "../policies/employee-features-policy";
import { BirthDate } from "../value-objects/birth-date";

export type EmployeeProps = {
  establishmentId: UniqueEntityId;
  userId: UniqueEntityId;
  profileImageUrl: string | null;
  name: string;
  cpf: Cpf | null;
  birthDate: BirthDate | null;
  features: EmployeeFeature[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type EmployeeCreateProps = {
  establishmentId: UniqueEntityId;
  userId: UniqueEntityId;
  name: string;
  cpf?: Cpf | string | null;
  birthDate?: BirthDate | Date | null;
  extraFeatures?: string[];
  profileImageUrl?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export class Employee extends AggregateRoot<EmployeeProps> {
  get establishmentId() {
    return this.props.establishmentId;
  }

  get userId() {
    return this.props.userId;
  }

  get profileImageUrl() {
    return this.props.profileImageUrl;
  }

  get name() {
    return this.props.name;
  }

  get cpf() {
    return this.props.cpf;
  }

  get birthDate() {
    return this.props.birthDate;
  }

  get features() {
    return [...this.props.features];
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  static create(props: EmployeeCreateProps, id?: UniqueEntityId) {
    return new Employee(
      {
        establishmentId: props.establishmentId,
        userId: props.userId,
        profileImageUrl: Employee.normalizeOptionalText(props.profileImageUrl),
        name: Employee.normalizeRequiredText(props.name, "name"),
        cpf: Employee.normalizeCpf(props.cpf ?? null),
        birthDate: Employee.normalizeBirthDate(props.birthDate ?? null),
        features: EmployeeFeaturesPolicy.build(props.extraFeatures ?? []),
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );
  }

  static restore(props: EmployeeProps, id?: UniqueEntityId) {
    return new Employee(
      {
        ...props,
        name: Employee.normalizeRequiredText(props.name, "name"),
        features: EmployeeFeaturesPolicy.normalizePersisted(props.features),
      },
      id,
    );
  }

  changeName(name: string) {
    const normalizedName = Employee.normalizeRequiredText(name, "name");

    if (this.props.name === normalizedName) {
      return;
    }

    this.props.name = normalizedName;
    this.touch();
  }

  changeCpf(cpf: Cpf | null) {
    if ((cpf && this.props.cpf?.equals(cpf)) || this.props.cpf === cpf) {
      return;
    }

    this.props.cpf = cpf;
    this.touch();
  }

  changeBirthDate(birthDate: BirthDate | null) {
    if (
      this.props.birthDate !== null &&
      birthDate !== null &&
      this.props.birthDate.equals(birthDate)
    ) {
      return;
    }

    if (this.props.birthDate === birthDate) {
      return;
    }

    this.props.birthDate = birthDate;
    this.touch();
  }

  replaceFeatures(extraFeatures: string[]) {
    this.props.features = EmployeeFeaturesPolicy.build(extraFeatures);
    this.touch();
  }

  touch() {
    this.props.updatedAt = new Date();
  }

  private static normalizeCpf(value: Cpf | string | null) {
    if (value === null) {
      return null;
    }

    if (value instanceof Cpf) {
      return value;
    }

    if (!value.trim()) {
      return null;
    }

    return Cpf.create(value);
  }

  private static normalizeBirthDate(value: BirthDate | Date | null) {
    if (value === null) {
      return null;
    }

    if (value instanceof BirthDate) {
      return value;
    }

    return BirthDate.create(value);
  }

  private static normalizeRequiredText(value: string, field: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new InvalidRegisterEmployeeInputError(`${field} is required.`);
    }

    return normalized;
  }

  private static normalizeOptionalText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();

    if (!normalized) {
      return null;
    }

    return normalized;
  }
}
