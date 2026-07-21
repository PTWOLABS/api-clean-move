import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeCustomer } from "../../../../../tests/factories/customer-factory";
import { makeQuote } from "../../../../../tests/factories/quote-factory";
import { InMemoryCustomersRepository } from "../../../../../tests/repositories/in-memory-customers-repository";
import { QuoteCustomerMatcher } from "./quote-customer-matcher";

let customersRepository: InMemoryCustomersRepository;
let sut: QuoteCustomerMatcher;

describe("Quote customer matcher", () => {
  beforeEach(() => {
    customersRepository = new InMemoryCustomersRepository();
    sut = new QuoteCustomerMatcher(customersRepository);
  });

  it("should auto-link an active document match", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({
      establishmentId,
      cpfCnpj: CustomerDocument.create("529.982.247-25"),
    });
    const quote = makeQuote({
      establishmentId,
      customer: {
        name: "Other Name",
        phone: null,
        email: null,
        cpfCnpj: "52998224725",
        address: null,
      },
    });

    await customersRepository.create(customer);

    const documentMatch = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(documentMatch.status).toBe("AUTO_LINK");
    expect(documentMatch.automaticCustomerId).toBe(customer.id.toString());
    expect(documentMatch.requiresResolution).toBe(false);
  });

  it("should require resolution for phone and email evidence matches", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({
      establishmentId,
      cpfCnpj: null,
      fullName: "Roberto Existing",
      phone: Phone.create("(11) 98765-4321"),
      email: new Email("robertinho@example.com"),
    });
    const quote = makeQuote({
      establishmentId,
      customer: {
        name: "Robertinho Contador",
        phone: "11987654321",
        email: "ROBERTINHO@example.com",
        cpfCnpj: null,
        address: null,
      },
    });

    await customersRepository.create(customer);

    const phoneAndEmailMatch = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(phoneAndEmailMatch).toMatchObject({
      status: "CANDIDATES_FOUND",
      requiresResolution: true,
    });
    expect(phoneAndEmailMatch.candidates[0]?.matchedBy).toEqual([
      "PHONE",
      "EMAIL",
    ]);
  });

  it("should require resolution for name-only candidates", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({
      establishmentId,
      cpfCnpj: null,
      fullName: "Robertinho Contador",
      phone: Phone.create("11912345678"),
      email: new Email("other@example.com"),
    });
    const quote = makeQuote({
      establishmentId,
      customer: {
        name: "Robertinho Contador",
        phone: null,
        email: null,
        cpfCnpj: null,
        address: null,
      },
    });

    await customersRepository.create(customer);

    const nameOnlyMatch = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(nameOnlyMatch.status).toBe("CANDIDATES_FOUND");
    expect(nameOnlyMatch.candidates[0]?.advisoryOnly).toBe(true);
    expect(nameOnlyMatch.requiresResolution).toBe(true);
  });

  it("should use quote snapshot email as customer evidence", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({
      establishmentId,
      cpfCnpj: null,
      email: new Email("snapshot@example.com"),
    });
    const quote = makeQuote({
      establishmentId,
      customer: {
        name: "Cliente Snapshot",
        phone: null,
        email: "SNAPSHOT@example.com",
        cpfCnpj: null,
        address: null,
      },
    });

    await customersRepository.create(customer);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "CANDIDATES_FOUND",
      requiresResolution: true,
    });
    expect(analysis.candidates[0]?.matchedBy).toEqual(["EMAIL"]);
  });

  it("should report separate candidates when phone and email point to different customers", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const phoneCustomer = makeCustomer({
      establishmentId,
      cpfCnpj: null,
      phone: Phone.create("11987654321"),
      email: new Email("phone@example.com"),
    });
    const emailCustomer = makeCustomer({
      establishmentId,
      cpfCnpj: null,
      phone: Phone.create("11912345678"),
      email: new Email("robertinho@example.com"),
    });
    const quote = makeQuote({
      establishmentId,
      customer: {
        name: "Robertinho Contador",
        phone: "(11) 98765-4321",
        email: "robertinho@example.com",
        cpfCnpj: null,
        address: null,
      },
    });

    await customersRepository.create(phoneCustomer);
    await customersRepository.create(emailCustomer);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "CANDIDATES_FOUND",
      requiresResolution: true,
    });
    expect(analysis.candidates).toHaveLength(2);
    expect(
      analysis.candidates.map((candidate) => candidate.customerId),
    ).toEqual([phoneCustomer.id.toString(), emailCustomer.id.toString()]);
  });

  it("should resolve an active linked customer", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId, cpfCnpj: null });
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
    });

    await customersRepository.create(customer);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toEqual({
      status: "RESOLVED",
      requiresResolution: false,
      automaticCustomerId: customer.id.toString(),
      candidates: [],
    });
  });

  it("should require resolution when the linked customer is deleted", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const customer = makeCustomer({ establishmentId, cpfCnpj: null });
    customer.softDelete(new Date("2026-07-13T10:00:00.000Z"));
    const quote = makeQuote({
      establishmentId,
      customerId: customer.id,
    });

    await customersRepository.create(customer);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "LINKED_RESOURCE_DELETED",
      requiresResolution: true,
      automaticCustomerId: null,
    });
  });

  it("should scope matches to the requested establishment", async () => {
    const establishmentId = new UniqueEntityId("establishment-1");
    const otherEstablishmentId = new UniqueEntityId("establishment-2");
    const otherCustomer = makeCustomer({
      establishmentId: otherEstablishmentId,
      cpfCnpj: CustomerDocument.create("52998224725"),
    });
    const quote = makeQuote({
      establishmentId,
      customer: {
        name: "Robertinho Contador",
        phone: null,
        email: null,
        cpfCnpj: "52998224725",
        address: null,
      },
    });

    await customersRepository.create(otherCustomer);

    const analysis = await sut.analyze({
      quote,
      establishmentId: establishmentId.toString(),
    });

    expect(analysis).toMatchObject({
      status: "CREATE_REQUIRED",
      requiresResolution: true,
      automaticCustomerId: null,
      candidates: [],
    });
  });
});
