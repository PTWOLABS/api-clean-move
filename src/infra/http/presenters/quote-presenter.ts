import { Quote } from "../../../modules/quotes/domain/entities/quote";
import {
  QuoteItemDTO,
  QuoteListItemDTO,
  QuoteStatus,
} from "../contracts/quote.dto";

export class QuotePresenter {
  private static getUtcDayBounds(referenceDate: Date) {
    const todayStart = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
      ),
    );
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(todayStart.getUTCDate() + 1);

    return { todayStart, tomorrowStart };
  }

  private static getListStatus(quote: Quote, referenceDate: Date): QuoteStatus {
    if (quote.convertedAppointmentId) {
      return "APPROVED";
    }

    if (!quote.expiresAt) {
      return "VALID";
    }

    const { todayStart, tomorrowStart } =
      QuotePresenter.getUtcDayBounds(referenceDate);

    if (quote.expiresAt < todayStart) {
      return "EXPIRED";
    }

    if (quote.expiresAt < tomorrowStart) {
      return "EXPIRES_TODAY";
    }

    return "VALID";
  }

  private static getVehicleLabel(quote: Quote) {
    if (!quote.vehicle) {
      return null;
    }

    const label = [
      quote.vehicle.brand,
      quote.vehicle.model,
      quote.vehicle.year?.toString(),
    ]
      .filter(Boolean)
      .join(" ");

    return label || null;
  }

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

  static toListItem(
    quote: Quote,
    referenceDate: Date = new Date(),
  ): QuoteListItemDTO {
    return {
      id: quote.id.toString(),
      customerName: quote.customer.name,
      customerKind: quote.customerId ? "CUSTOMER" : "PROSPECT",
      vehicleLabel: QuotePresenter.getVehicleLabel(quote),
      vehiclePlate: quote.vehicle?.plate ?? null,
      totalInCents:
        quote.paymentOptions.at(0)?.totalInCents ?? quote.subtotalInCents,
      status: QuotePresenter.getListStatus(quote, referenceDate),
      approvedAt: quote.convertedAt?.toISOString() ?? null,
      expiresAt: quote.expiresAt?.toISOString() ?? null,
      createdAt: quote.createdAt.toISOString(),
      servicesCount: quote.services.length,
    };
  }
}
