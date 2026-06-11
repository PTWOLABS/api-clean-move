import { Injectable } from "@nestjs/common";
import { Establishment } from "../../establishments/domain/entities/establishment";

@Injectable()
export abstract class EstablishmentsRepository {
  abstract create(data: Establishment): Promise<void>;
  abstract save(establishment: Establishment): Promise<void>;
  abstract findById(id: string): Promise<Establishment | null>;
  abstract findByOwnerId(ownerId: string): Promise<Establishment | null>;
  abstract findByCnpj(cnpj: string): Promise<Establishment | null>;
  abstract findBySlug(slug: string): Promise<Establishment | null>;
  abstract findBySlugOrCnpj(
    slug: string,
    cnpj: string,
  ): Promise<Establishment | null>;
  abstract findMany(filters?: {
    establishmentName?: string;
    serviceCategoryId?: string;
  }): Promise<Establishment[]>;
}
