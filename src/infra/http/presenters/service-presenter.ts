import { Service } from "../../../modules/catalog/domain/entities/services";

export class ServicePresenter {
  static toHTTP(service: Service) {
    return {
      id: service.id.toString(),
      establishmentId: service.establishmentId.toString(),
      name: service.serviceName.value,
      description: service.description ?? null,
      category: service.category
        ? {
            id: service.category.id.toString(),
            name: service.category.name,
          }
        : null,
      estimatedDuration: service.estimatedDuration
        ? {
            minInMinutes: service.estimatedDuration.minInMinutes,
            maxInMinutes: service.estimatedDuration.maxInMinutes,
          }
        : null,
      priceInCents: service.price.amountInCents,
      isActive: service.isActive,
      createdAt: service.createdAt?.toISOString() ?? null,
      updatedAt: service.updatedAt?.toISOString() ?? null,
    };
  }
}
