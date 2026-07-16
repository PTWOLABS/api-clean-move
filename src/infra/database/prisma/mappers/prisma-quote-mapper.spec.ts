import {
  PrismaQuoteMapper,
  PrismaQuoteWithRelations,
  toQuoteServicesCreate,
} from "./prisma-quote-mapper";

describe("PrismaQuoteMapper", () => {
  it("should round-trip quote service row ids and map only resolution updates", () => {
    const rawQuote: PrismaQuoteWithRelations = {
      id: "quote-1",
      establishmentId: "establishment-1",
      customerId: "customer-1",
      vehicleId: "vehicle-1",
      convertedAppointmentId: null,
      convertedAt: null,
      establishmentName: "Studio Clean Move",
      establishmentLegalBusinessName: "Studio Clean Move LTDA",
      establishmentCnpj: "50224464000150",
      establishmentAddress: null,
      establishmentBannerImageUrl: null,
      customerName: "Robertinho Contador",
      customerPhone: null,
      customerEmail: "robertinho@example.com",
      customerCpfCnpj: null,
      customerAddress: null,
      vehiclePlate: "ABC1D23",
      vehicleBrand: "Honda",
      vehicleModel: "HR-V",
      vehicleColor: "Branco",
      vehicleYear: 2025,
      description: null,
      termsAndConditions: null,
      expiresAt: null,
      createdAt: new Date("2026-05-22T10:00:00.000Z"),
      updatedAt: new Date("2026-05-22T10:00:00.000Z"),
      services: [
        {
          id: "quote-service-1",
          quoteId: "quote-1",
          serviceId: "service-1",
          serviceName: "Lavagem detalhada",
          serviceCategoryId: null,
          serviceCategoryName: null,
          serviceDurationInMinutes: 60,
          servicePriceInCents: 32500,
          isCourtesy: false,
          position: 0,
        },
      ],
      paymentOptions: [
        {
          id: "payment-option-1",
          quoteId: "quote-1",
          method: "CARD",
          label: "Cartao em ate 10x sem juros",
          installments: 10,
          interestFree: true,
          discountType: null,
          discountValue: null,
          totalInCents: 32500,
          position: 0,
        },
      ],
    };

    const quote = PrismaQuoteMapper.toDomain(rawQuote);

    expect(quote.customer.email).toBe("robertinho@example.com");
    expect(quote.services[0]?.quoteServiceId.toString()).toBe(
      "quote-service-1",
    );

    const create = toQuoteServicesCreate(quote);

    expect(create[0]?.id).toBe("quote-service-1");

    const update = PrismaQuoteMapper.toPrismaResolutionUpdate(quote);

    expect(update).toEqual({
      customerId: quote.customerId?.toString() ?? null,
      vehicleId: quote.vehicleId?.toString() ?? null,
      updatedAt: quote.updatedAt,
      services: {
        update: [
          {
            where: { id: "quote-service-1" },
            data: {
              serviceId: quote.services[0]?.serviceId?.toString() ?? null,
              serviceName: quote.services[0]?.serviceName,
            },
          },
        ],
      },
    });
    expect(update).not.toHaveProperty("paymentOptions");
  });
});
