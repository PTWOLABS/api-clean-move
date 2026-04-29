import { ValueObject } from "../../../../shared/entities/value-object";
import {
  Cpf,
  InvalidCpfError,
} from "../../../accounts/domain/value-objects/cpf";
import {
  Cnpj,
  InvalidCnpjError,
} from "../../../establishments/domain/value-objects/cnpj";

type CustomerDocumentType = "CPF" | "CNPJ";

type CustomerDocumentProps = {
  type: CustomerDocumentType;
  value: string;
};

export class InvalidCustomerDocumentError extends Error {
  constructor(value: string) {
    super(`Invalid customer document: ${value}`);
    this.name = "InvalidCustomerDocumentError";
  }
}

export class CustomerDocument extends ValueObject<CustomerDocumentProps> {
  private constructor(props: CustomerDocumentProps) {
    super(props);
  }

  get type() {
    return this.props.type;
  }

  get value() {
    return this.props.value;
  }

  get formatted() {
    if (this.props.type === "CPF") {
      return Cpf.create(this.props.value).formatted;
    }

    return Cnpj.create(this.props.value).formatted;
  }

  static create(rawValue: string) {
    const normalized = rawValue.replace(/\D/g, "");

    try {
      if (normalized.length === 11) {
        return new CustomerDocument({
          type: "CPF",
          value: Cpf.create(normalized).toString(),
        });
      }

      if (normalized.length === 14) {
        return new CustomerDocument({
          type: "CNPJ",
          value: Cnpj.create(normalized).toString(),
        });
      }
    } catch (error) {
      if (
        error instanceof InvalidCpfError ||
        error instanceof InvalidCnpjError
      ) {
        throw new InvalidCustomerDocumentError(rawValue);
      }

      throw error;
    }

    throw new InvalidCustomerDocumentError(rawValue);
  }

  toString() {
    return this.props.value;
  }
}
