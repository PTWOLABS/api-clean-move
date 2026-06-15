import { ServiceCategory } from "../../../modules/catalog/domain/entities/service-category";

export class ServiceCategoryPresenter {
  static toHTTP(category: ServiceCategory) {
    return {
      id: category.id.toString(),
      establishmentId: category.establishmentId.toString(),
      name: category.name.value,
      deletedAt: category.deletedAt?.toISOString() ?? null,
      createdAt: category.createdAt?.toISOString() ?? null,
      updatedAt: category.updatedAt?.toISOString() ?? null,
    };
  }
}
