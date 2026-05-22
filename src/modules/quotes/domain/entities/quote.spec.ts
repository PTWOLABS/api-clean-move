import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { InvalidQuoteInputError } from "../errors/invalid-quote-input-error";
import {
  Quote,
  QuoteCreateProps,
  QuotePaymentOption,
  QuotedServiceSnapshot,
} from "./quote";

const baseProps = {
  establishmentId: new UniqueEntityId("establishment-1"),
  customerId: null,
  vehicleId: null,
  convertedAppointmentId: null,
  convertedAt: null,
  establishment: {
    name: "Studio Clean Move",
    legalBusinessName: "Studio Clean Move LTDA",
    cnpj: "50224464000150",
    address: null,
    bannerImageUrl: null,
  },
  customer: {
    name: "Robertinho Contador",
    phone: null,
    cpfCnpj: null,
    address: null,
  },
  vehicle: {
    plate: null,
    brand: "Honda",
    model: "HR-V",
    color: "Branco",
    year: 2025,
  },
  services: [
    {
      serviceId: new UniqueEntityId("service-1"),
      serviceName: "Lavagem detalhada",
      category: "WASH" as const,
      durationInMinutes: 60,
      priceInCents: 32500,
      isCourtesy: false,
    },
    {
      serviceId: new UniqueEntityId("service-2"),
      serviceName: "Cristalizacao dos vidros",
      category: "PROTECTION" as const,
      durationInMinutes: 30,
      priceInCents: 40000,
      isCourtesy: true,
    },
  ],
  paymentOptions: [
    {
      method: "CARD" as const,
      label: "Cartao em ate 10x sem juros",
      installments: 10,
      interestFree: true,
      discountType: null,
      discountValue: null,
    },
    {
      method: "PIX" as const,
      label: "A vista no Pix",
      installments: 1,
      interestFree: true,
      discountType: "PERCENTAGE" as const,
      discountValue: 10,
    },
  ],
  description: "Avaliar pintura antes da execucao.",
  termsAndConditions: "Orcamento valido por 10 dias.",
  expiresAt: new Date("2026-05-31T23:59:59.000Z"),
} satisfies QuoteCreateProps;

describe("Quote", () => {
  it("should create a quote with snapshots, services, payment options, description, terms, and expiration", () => {
    const quote = Quote.create(baseProps);

    expect(quote.establishment.name).toEqual("Studio Clean Move");
    expect(quote.customer?.name).toEqual("Robertinho Contador");
    expect(quote.vehicle?.model).toEqual("HR-V");
    expect(quote.services).toHaveLength(2);
    expect(quote.paymentOptions).toHaveLength(2);
    expect(quote.services[0]).toBeInstanceOf(QuotedServiceSnapshot);
    expect(quote.paymentOptions[0]).toBeInstanceOf(QuotePaymentOption);
    expect(quote.description).toEqual("Avaliar pintura antes da execucao.");
    expect(quote.termsAndConditions).toEqual("Orcamento valido por 10 dias.");
    expect(quote.expiresAt).toEqual(baseProps.expiresAt);
  });

  it("should default omitted expiration to null", () => {
    const { expiresAt: _expiresAt, ...propsWithoutExpiration } = baseProps;

    const quote = Quote.create(propsWithoutExpiration);

    expect(quote.expiresAt).toBeNull();
  });

  it("should accept explicit null expiration", () => {
    const quote = Quote.create({
      ...baseProps,
      expiresAt: null,
    });

    expect(quote.expiresAt).toBeNull();
  });

  it("should not accept invalid dates", () => {
    const invalidDate = new Date("invalid-date");

    expect(() =>
      Quote.create({
        ...baseProps,
        expiresAt: invalidDate,
      }),
    ).toThrow(InvalidQuoteInputError);

    expect(() =>
      Quote.create({
        ...baseProps,
        createdAt: invalidDate,
      }),
    ).toThrow(InvalidQuoteInputError);

    expect(() =>
      Quote.create({
        ...baseProps,
        updatedAt: invalidDate,
      }),
    ).toThrow(InvalidQuoteInputError);

    expect(() =>
      Quote.create({
        ...baseProps,
        convertedAppointmentId: new UniqueEntityId("appointment-1"),
        convertedAt: invalidDate,
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should accept services without category or duration", () => {
    const quote = Quote.create({
      ...baseProps,
      services: [
        {
          ...baseProps.services[0]!,
          category: undefined,
          durationInMinutes: undefined,
        },
      ],
    });

    expect(quote.services[0]?.category).toBeUndefined();
    expect(quote.services[0]?.durationInMinutes).toBeUndefined();
  });

  it("should not accept zero service duration", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        services: [
          {
            ...baseProps.services[0]!,
            durationInMinutes: 0,
          },
        ],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should calculate subtotal excluding courtesy services", () => {
    const quote = Quote.create(baseProps);

    expect(quote.subtotalInCents).toEqual(32500);
  });

  it("should keep courtesy original price and expose total courtesy value", () => {
    const quote = Quote.create(baseProps);

    expect(quote.services[1]?.priceInCents).toEqual(40000);
    expect(quote.services[1]?.isCourtesy).toBe(true);
    expect(quote.totalCourtesyValueInCents).toEqual(40000);
  });

  it("should not accept invalid courtesy flags", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        services: [
          {
            ...baseProps.services[0]!,
            isCourtesy: "yes" as never,
          },
        ],
      }),
    ).toThrow(InvalidQuoteInputError);

    expect(() =>
      Quote.create({
        ...baseProps,
        services: [
          {
            ...baseProps.services[0]!,
            isCourtesy: null as never,
          },
        ],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should calculate payment option totals from the non-courtesy subtotal", () => {
    const quote = Quote.create(baseProps);

    expect(quote.paymentOptions[0]?.totalInCents).toEqual(32500);
    expect(quote.paymentOptions[1]?.totalInCents).toEqual(29250);
  });

  it("should not expose mutable internal snapshots through getters", () => {
    const quote = Quote.create({
      ...baseProps,
      establishment: {
        ...baseProps.establishment,
        address: {
          street: "Rua Original",
          country: "Brasil",
          state: "SP",
          zipCode: "01001000",
          city: "Sao Paulo",
          complement: null,
        },
      },
      customer: {
        ...baseProps.customer,
        address: {
          street: "Rua Cliente",
          country: "Brasil",
          state: "SP",
          zipCode: "02002000",
          city: "Sao Paulo",
          complement: null,
        },
      },
    });

    const services = quote.services.map((service) => service.toValue());
    const paymentOptions = quote.paymentOptions.map((paymentOption) =>
      paymentOption.toValue(),
    );
    const establishment = quote.establishment;
    const customer = quote.customer;
    const vehicle = quote.vehicle;

    services[0]!.priceInCents = 1;
    services[1]!.isCourtesy = false;
    paymentOptions[0]!.totalInCents = 1;
    establishment.name = "Changed";
    establishment.address!.street = "Changed";
    customer.name = "Changed";
    customer.address!.street = "Changed";
    vehicle!.model = "Changed";

    expect(quote.services[0]?.priceInCents).toEqual(32500);
    expect(quote.services[1]?.isCourtesy).toBe(true);
    expect(quote.paymentOptions[0]?.totalInCents).toEqual(32500);
    expect(quote.establishment.name).toEqual("Studio Clean Move");
    expect(quote.establishment.address?.street).toEqual("Rua Original");
    expect(quote.customer.name).toEqual("Robertinho Contador");
    expect(quote.customer.address?.street).toEqual("Rua Cliente");
    expect(quote.vehicle?.model).toEqual("HR-V");
    expect(quote.subtotalInCents).toEqual(32500);
    expect(quote.totalCourtesyValueInCents).toEqual(40000);
  });

  it("should not accept quotes without services", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        services: [],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should not accept duplicate services", () => {
    const duplicatedService = baseProps.services[0]!;

    expect(() =>
      Quote.create({
        ...baseProps,
        services: [duplicatedService, duplicatedService],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should not accept quotes without payment options", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        paymentOptions: [],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should not accept percentage discounts greater than 100", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        paymentOptions: [
          {
            method: "PIX",
            label: "Pix",
            discountType: "PERCENTAGE",
            discountValue: 101,
          },
        ],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should not accept invalid payment methods", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        paymentOptions: [
          {
            method: "BOLETO" as never,
            label: "Boleto",
          },
        ],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should not accept invalid interest-free flags", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        paymentOptions: [
          {
            method: "CARD",
            label: "Cartao",
            interestFree: "yes" as never,
          },
        ],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should not accept invalid discount types", () => {
    expect(() =>
      Quote.create({
        ...baseProps,
        paymentOptions: [
          {
            method: "PIX",
            label: "Pix",
            discountType: "COUPON" as never,
            discountValue: 10,
          },
        ],
      }),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should mark a quote as converted once", () => {
    const quote = Quote.create(baseProps);
    const appointmentId = new UniqueEntityId("appointment-1");
    const convertedAt = new Date("2026-05-25T10:00:00.000Z");

    quote.markAsConverted(appointmentId, convertedAt);

    expect(quote.convertedAppointmentId).toEqual(appointmentId);
    expect(quote.convertedAt).toEqual(convertedAt);
    expect(quote.updatedAt.getTime()).toBeGreaterThanOrEqual(
      convertedAt.getTime(),
    );
  });

  it("should not accept invalid conversion reference date", () => {
    const quote = Quote.create(baseProps);

    expect(() =>
      quote.markAsConverted(
        new UniqueEntityId("appointment-1"),
        new Date("invalid-date"),
      ),
    ).toThrow(InvalidQuoteInputError);
  });

  it("should not convert a quote more than once", () => {
    const quote = Quote.create({
      ...baseProps,
      convertedAppointmentId: new UniqueEntityId("appointment-1"),
      convertedAt: new Date("2026-05-25T10:00:00.000Z"),
    });

    expect(() =>
      quote.markAsConverted(new UniqueEntityId("appointment-2")),
    ).toThrow(InvalidQuoteInputError);
  });
});
