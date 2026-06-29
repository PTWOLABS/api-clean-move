import {
  QuoteFilters,
  QuoteListResult,
  QuoteSummary,
  QuotesRepository,
} from "../../src/modules/application/repositories/quotes-repository";
import { Quote } from "../../src/modules/quotes/domain/entities/quote";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";

export class InMemoryQuotesRepository implements QuotesRepository {
  public items: Quote[] = [];

  private static normalizeTextFilter(value?: string): string | undefined {
    const normalized = value?.trim();

    return normalized || undefined;
  }

  private static normalizePlateFilter(value?: string | null) {
    const normalized = value?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    return normalized || undefined;
  }

  private static matchesText(value: string | null | undefined, filter: string) {
    return value?.toLowerCase().includes(filter.toLowerCase()) ?? false;
  }

  private static toDateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }

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

  private static summarizeQuotes(
    quotes: Quote[],
    referenceDate: Date,
  ): QuoteSummary {
    const { todayStart, tomorrowStart } =
      InMemoryQuotesRepository.getUtcDayBounds(referenceDate);

    return quotes.reduce<QuoteSummary>(
      (summary, quote) => {
        if (quote.convertedAppointmentId) {
          summary.approved += 1;
          return summary;
        }

        if (!quote.expiresAt || quote.expiresAt >= tomorrowStart) {
          summary.valid += 1;
          return summary;
        }

        if (quote.expiresAt >= todayStart) {
          summary.expiresToday += 1;
          return summary;
        }

        summary.expired += 1;
        return summary;
      },
      {
        valid: 0,
        expiresToday: 0,
        approved: 0,
        expired: 0,
      },
    );
  }

  private static matchesServiceFilters(quote: Quote, filters?: QuoteFilters) {
    const serviceId = InMemoryQuotesRepository.normalizeTextFilter(
      filters?.serviceId,
    );
    const serviceName = InMemoryQuotesRepository.normalizeTextFilter(
      filters?.serviceName,
    );

    if (
      serviceId &&
      !quote.services.some(
        (service) => service.serviceId.toString() === serviceId,
      )
    ) {
      return false;
    }

    if (
      serviceName &&
      !quote.services.some((service) =>
        InMemoryQuotesRepository.matchesText(service.serviceName, serviceName),
      )
    ) {
      return false;
    }

    return true;
  }

  private static matchesTextFilters(quote: Quote, filters?: QuoteFilters) {
    const search = InMemoryQuotesRepository.normalizeTextFilter(
      filters?.search,
    );
    const customerName = InMemoryQuotesRepository.normalizeTextFilter(
      filters?.customerName,
    );
    const vehiclePlate = InMemoryQuotesRepository.normalizePlateFilter(
      filters?.vehiclePlate,
    );

    if (
      customerName &&
      !InMemoryQuotesRepository.matchesText(quote.customer.name, customerName)
    ) {
      return false;
    }

    if (
      vehiclePlate &&
      !InMemoryQuotesRepository.normalizePlateFilter(
        quote.vehicle?.plate,
      )?.includes(vehiclePlate)
    ) {
      return false;
    }

    if (!search) {
      return true;
    }

    const normalizedSearchPlate =
      InMemoryQuotesRepository.normalizePlateFilter(search);
    const matchesPlate =
      normalizedSearchPlate &&
      InMemoryQuotesRepository.normalizePlateFilter(
        quote.vehicle?.plate,
      )?.includes(normalizedSearchPlate);

    if (matchesPlate) {
      return true;
    }

    const searchableValues = [
      quote.customer.name,
      quote.customer.phone,
      quote.customer.cpfCnpj,
      quote.vehicle?.brand,
      quote.vehicle?.model,
      ...quote.services.map((service) => service.serviceName),
    ];

    return searchableValues.some((value) =>
      InMemoryQuotesRepository.matchesText(value, search),
    );
  }

  private static sortQuotes(quotes: Quote[], filters?: QuoteFilters) {
    const sortMultiplier = filters?.sort === "oldest" ? 1 : -1;

    return quotes.sort((a, b) => {
      return sortMultiplier * (a.createdAt.getTime() - b.createdAt.getTime());
    });
  }

  private filterByEstablishmentId(
    establishmentId: string,
    filters?: QuoteFilters,
  ) {
    const filteredQuotes = this.items
      .slice()
      .filter((item) => item.establishmentId.toString() === establishmentId)
      .filter((item) => {
        const customerId = InMemoryQuotesRepository.normalizeTextFilter(
          filters?.customerId,
        );
        const vehicleId = InMemoryQuotesRepository.normalizeTextFilter(
          filters?.vehicleId,
        );

        if (customerId && item.customerId?.toString() !== customerId) {
          return false;
        }

        if (vehicleId && item.vehicleId?.toString() !== vehicleId) {
          return false;
        }

        if (
          filters?.expiresFrom &&
          (!item.expiresAt || item.expiresAt < filters.expiresFrom)
        ) {
          return false;
        }

        if (
          filters?.expiresTo &&
          (!item.expiresAt || item.expiresAt > filters.expiresTo)
        ) {
          return false;
        }

        if (
          filters?.converted !== undefined &&
          Boolean(item.convertedAppointmentId) !== filters.converted
        ) {
          return false;
        }

        if (
          filters?.createdAt &&
          InMemoryQuotesRepository.toDateOnly(item.createdAt) !==
            InMemoryQuotesRepository.toDateOnly(filters.createdAt)
        ) {
          return false;
        }

        if (!InMemoryQuotesRepository.matchesServiceFilters(item, filters)) {
          return false;
        }

        return InMemoryQuotesRepository.matchesTextFilters(item, filters);
      });

    return InMemoryQuotesRepository.sortQuotes(filteredQuotes, filters);
  }

  async create(quote: Quote): Promise<void> {
    this.items.push(quote);
  }

  async findById(id: string): Promise<Quote | null> {
    const quote = this.items.find((item) => item.id.toString() === id);

    if (!quote) {
      return null;
    }

    return quote;
  }

  async findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Quote | null> {
    const quote = this.items.find(
      (item) =>
        item.id.toString() === id &&
        item.establishmentId.toString() === establishmentId,
    );

    if (!quote) {
      return null;
    }

    return quote;
  }

  async findManyByEstablishmentId(
    establishmentId: string,
    filters?: QuoteFilters,
    referenceDate = new Date(),
  ): Promise<QuoteListResult> {
    const page = filters?.page ?? 1;
    const size = filters?.size ?? 20;
    const filteredQuotes = this.filterByEstablishmentId(
      establishmentId,
      filters,
    );
    const totalItems = filteredQuotes.length;
    const summary = InMemoryQuotesRepository.summarizeQuotes(
      filteredQuotes,
      referenceDate,
    );

    const start = (page - 1) * size;
    const end = start + size;

    return {
      quotes: filteredQuotes.slice(start, end),
      totalItems,
      summary,
    };
  }

  async markAsConverted(
    quote: Quote,
    appointmentId: UniqueEntityId,
    convertedAt: Date,
  ): Promise<boolean> {
    const persistedQuote = this.items.find((item) => item.id.equals(quote.id));

    if (!persistedQuote || persistedQuote.convertedAppointmentId) {
      return false;
    }

    persistedQuote.markAsConverted(appointmentId, convertedAt);

    if (persistedQuote !== quote) {
      quote.markAsConverted(appointmentId, convertedAt);
    }

    return true;
  }

  async save(quote: Quote): Promise<void> {
    const quoteIndex = this.items.findIndex((item) => item.id.equals(quote.id));

    if (quoteIndex === -1) {
      this.items.push(quote);
      return;
    }

    this.items[quoteIndex] = quote;
  }
}
