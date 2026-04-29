import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { CustomerDocument } from "../value-objects/customer-document";
import { Customer } from "./customer";

describe("Customer", () => {
  it("should create an establishment-owned customer", () => {
    const customer = Customer.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      cpfCnpj: CustomerDocument.create("52998224725"),
      fullName: "Maria Silva",
      phone: Phone.create("11999999999"),
      email: new Email("maria@example.com"),
      address: Address.create({
        street: "Rua A",
        country: "Brasil",
        state: "SP",
        zipCode: "01001-000",
        city: "Sao Paulo",
      }),
      birthDate: new Date("1990-01-01"),
      nickname: "Maria",
    });

    expect(customer.establishmentId.toString()).toBe("establishment-1");
    expect(customer.cpfCnpj?.toString()).toBe("52998224725");
    expect(customer.cpfCnpj?.type).toBe("CPF");
    expect(customer.fullName).toBe("Maria Silva");
    expect(customer.deletedAt).toBeNull();
    expect(customer.isDeleted()).toBe(false);
  });

  it("should soft-delete a customer", () => {
    const customer = Customer.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      cpfCnpj: null,
      fullName: "Jose Silva",
      phone: Phone.create("11988888888"),
      email: new Email("jose@example.com"),
      address: null,
      birthDate: null,
      nickname: null,
    });

    const deletedAt = new Date("2026-04-27T10:00:00.000Z");
    customer.softDelete(deletedAt);

    expect(customer.deletedAt).toEqual(deletedAt);
    expect(customer.isDeleted()).toBe(true);
  });

  it("should accept a CNPJ customer document", () => {
    const customer = Customer.create({
      establishmentId: new UniqueEntityId("establishment-1"),
      cpfCnpj: CustomerDocument.create("81936265000106"),
      fullName: "Empresa Silva",
      phone: Phone.create("11988888888"),
      email: new Email("empresa@example.com"),
      address: null,
      birthDate: null,
      nickname: null,
    });

    expect(customer.cpfCnpj?.toString()).toBe("81936265000106");
    expect(customer.cpfCnpj?.type).toBe("CNPJ");
  });
});
