import { Establishment } from "../../../modules/establishments/domain/entities/establishment";

export class EstablishmentPresenter {
  static toHTTP(establishment: Establishment) {
    return {
      id: establishment.id.toString(),
      tradeName: establishment.tradeName,
      legalBusinessName: establishment.legalBusinessName,
      cnpj: establishment.cnpj?.toString() ?? null,
      slug: establishment.slug?.value ?? null,
    };
  }
}
