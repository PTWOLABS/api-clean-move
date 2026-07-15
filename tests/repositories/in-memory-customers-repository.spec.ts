import { Email } from "../../src/modules/accounts/domain/value-objects/email";
import { Phone } from "../../src/modules/accounts/domain/value-objects/phone";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";
import { makeCustomer } from "../factories/customer-factory";
import { InMemoryCustomersRepository } from "./in-memory-customers-repository";

let inMemoryCustomersRepository: InMemoryCustomersRepository;

describe("In-memory customers repository", () => {
  beforeEach(() => {
    inMemoryCustomersRepository = new InMemoryCustomersRepository();
  });

  it("should find active customers by exact evidence in the establishment", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const otherEstablishmentId = new UniqueEntityId("establishment-2");

    const phoneMatchedCustomer = makeCustomer({
      establishmentId,
      fullName: "Phone Match",
      cpfCnpj: null,
      phone: Phone.create("(11) 98765-4321"),
      email: new Email("phone@example.com"),
    });
    const emailMatchedCustomer = makeCustomer({
      establishmentId,
      fullName: "Email Match",
      cpfCnpj: null,
      phone: Phone.create("11912345678"),
      email: new Email("customer@example.com"),
    });
    const nameMatchedCustomer = makeCustomer({
      establishmentId,
      fullName: "Maria Evidence",
      cpfCnpj: null,
      phone: Phone.create("11922223333"),
      email: new Email("name@example.com"),
    });
    const deletedCustomer = makeCustomer({
      establishmentId,
      fullName: "Maria Evidence",
      cpfCnpj: null,
      phone: Phone.create("11987654321"),
      email: new Email("deleted@example.com"),
    });
    const otherEstablishmentCustomer = makeCustomer({
      establishmentId: otherEstablishmentId,
      fullName: "Maria Evidence",
      cpfCnpj: null,
      phone: Phone.create("11987654321"),
      email: new Email("other@example.com"),
    });
    const partialNameCustomer = makeCustomer({
      establishmentId,
      fullName: "Maria Evidence Partial",
      cpfCnpj: null,
      phone: Phone.create("11933334444"),
      email: new Email("partial@example.com"),
    });

    deletedCustomer.softDelete(new Date("2026-07-13T10:00:00.000Z"));

    await inMemoryCustomersRepository.create(phoneMatchedCustomer);
    await inMemoryCustomersRepository.create(emailMatchedCustomer);
    await inMemoryCustomersRepository.create(nameMatchedCustomer);
    await inMemoryCustomersRepository.create(deletedCustomer);
    await inMemoryCustomersRepository.create(otherEstablishmentCustomer);
    await inMemoryCustomersRepository.create(partialNameCustomer);

    const customers =
      await inMemoryCustomersRepository.findManyActiveByEvidenceAndEstablishmentId(
        {
          phone: "(11) 98765-4321",
          email: "CUSTOMER@example.com",
          fullName: " Maria Evidence ",
        },
        establishmentId.toString(),
      );

    expect(customers).toHaveLength(3);
    expect(customers).toEqual([
      phoneMatchedCustomer,
      emailMatchedCustomer,
      nameMatchedCustomer,
    ]);
  });

  it("should return an empty list when evidence is empty", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    await inMemoryCustomersRepository.create(
      makeCustomer({ establishmentId, cpfCnpj: null }),
    );

    const customers =
      await inMemoryCustomersRepository.findManyActiveByEvidenceAndEstablishmentId(
        {},
        establishmentId.toString(),
      );

    expect(customers).toEqual([]);
  });
});
