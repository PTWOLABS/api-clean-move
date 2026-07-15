import { PaginationParams } from "../../../shared/types/pagination-params";
import { Customer } from "../../customer/domain/entities/customer";

export type CustomerFilters = {
  search?: string;
  includeDeleted?: boolean;
} & PaginationParams;

export type CustomerOption = {
  id: string;
  label: string;
};

export type CustomerOptionsFilters = {
  search?: string;
  limit?: number;
};

export type CustomerMatchEvidence = {
  phone?: string;
  email?: string;
  fullName?: string;
};

export type PaginatedCustomers = {
  customers: Customer[];
  totalItems: number;
};

export abstract class CustomersRepository {
  abstract create(customer: Customer): Promise<void>;
  abstract findById(id: string): Promise<Customer | null>;
  abstract findByIdAndEstablishmentId(
    id: string,
    establishmentId: string,
  ): Promise<Customer | null>;
  abstract findByIdAndEstablishmentIdIncludingDeleted(
    id: string,
    establishmentId: string,
  ): Promise<Customer | null>;
  abstract findManyByIdsAndEstablishmentIdIncludingDeleted(
    ids: string[],
    establishmentId: string,
  ): Promise<Customer[]>;
  abstract findActiveByCpfCnpjAndEstablishmentId(
    cpfCnpj: string,
    establishmentId: string,
  ): Promise<Customer | null>;
  abstract findManyActiveByEvidenceAndEstablishmentId(
    evidence: CustomerMatchEvidence,
    establishmentId: string,
  ): Promise<Customer[]>;
  abstract findManyByEstablishmentId(
    establishmentId: string,
    filters?: CustomerFilters,
  ): Promise<PaginatedCustomers>;
  abstract findOptionsByEstablishmentId(
    establishmentId: string,
    filters?: CustomerOptionsFilters,
  ): Promise<CustomerOption[]>;
  abstract save(customer: Customer): Promise<void>;
}
