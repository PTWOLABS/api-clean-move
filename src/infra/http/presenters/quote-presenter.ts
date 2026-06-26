import { Quote } from "../../../modules/quotes/domain/entities/quote";
import { QuoteItemDTO } from "../contracts/quote.dto";

export class QuotePresenter {
  static toHTTP(quote: Quote): QuoteItemDTO {
    return {
      id: quote.id.toString(),
      establishmentId: quote.establishmentId.toString(),
      customerId: quote.customerId?.toString() ?? null,
      vehicleId: quote.vehicleId?.toString() ?? null,
      convertedAppointmentId: quote.convertedAppointmentId?.toString() ?? null,
      convertedAt: quote.convertedAt?.toISOString() ?? null,
      establishment: quote.establishment,
      customer: quote.customer,
      vehicle: quote.vehicle,
      services: quote.services.map((service) => ({
        id: service.serviceId.toString(),
        name: service.serviceName,
        category: service.category
          ? {
              id: service.category.id.toString(),
              name: service.category.name,
            }
          : null,
        durationInMinutes: service.durationInMinutes ?? null,
        priceInCents: service.priceInCents,
        isCourtesy: service.isCourtesy,
      })),
      paymentOptions: quote.paymentOptions.map((option) => ({
        method: option.method,
        label: option.label,
        installments: option.installments,
        interestFree: option.interestFree,
        discountType: option.discountType,
        discountValue: option.discountValue,
        totalInCents: option.totalInCents,
      })),
      subtotalInCents: quote.subtotalInCents,
      totalCourtesyValueInCents: quote.totalCourtesyValueInCents,
      description: quote.description,
      termsAndConditions: quote.termsAndConditions,
      expiresAt: quote.expiresAt?.toISOString() ?? null,
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
    };
  }
}
