import { PaginationParams } from "../../../shared/types/pagination-params";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";
import { Quote } from "../../quotes/domain/entities/quote";

export type QuoteFilters = {
  search?: string;
  customerId?: string;
  customerName?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  serviceId?: string;
  serviceName?: string;
  expiresFrom?: Date;
  expiresTo?: Date;
  converted?: boolean;
  createdAt?: Date;
} & PaginationParams;

export type QuoteSummary = {
  valid: number;
  expiresToday: number;
  approved: number;
  expired: number;
};

export type QuoteListResult = {
  quotes: Quote[];
  totalItems: number;
  summary: QuoteSummary;
};

export abstract class QuotesRepository {
  abstract create(quote: Quote): Promise<void>;
  abstract findById(id: string): Promise<Quote | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Quote | null>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: QuoteFilters,
    referenceDate?: Date,
  ): Promise<QuoteListResult>;
  abstract markAsConverted(
    quote: Quote,
    appointmentId: UniqueEntityId,
    convertedAt: Date,
  ): Promise<boolean>;
  abstract save(quote: Quote): Promise<void>;
}
