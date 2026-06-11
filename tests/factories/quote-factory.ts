import {
  Quote,
  QuoteCreateProps,
} from "../../src/modules/quotes/domain/entities/quote";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";
import { makeServiceCategoryRef } from "../helpers/service-category-ref";

export function makeQuote(
  override?: Partial<QuoteCreateProps>,
  id?: UniqueEntityId,
) {
  return Quote.create(
    {
      establishmentId: new UniqueEntityId(),
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
          serviceId: new UniqueEntityId(),
          serviceName: "Lavagem detalhada",
          category: makeServiceCategoryRef("Lavagem"),
          durationInMinutes: 60,
          priceInCents: 32500,
          isCourtesy: false,
        },
      ],
      paymentOptions: [
        {
          method: "CARD",
          label: "Cartao em ate 10x sem juros",
          installments: 10,
          interestFree: true,
          discountType: null,
          discountValue: null,
        },
      ],
      description: "Avaliar pintura antes da execucao.",
      termsAndConditions: "Orcamento valido por 10 dias.",
      expiresAt: new Date("2026-05-31T23:59:59.000Z"),
      createdAt: new Date("2026-05-22T10:00:00.000Z"),
      updatedAt: new Date("2026-05-22T10:00:00.000Z"),
      ...override,
    },
    id,
  );
}
