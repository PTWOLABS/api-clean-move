import { DEFAULT_SERVICE_CATEGORY_NAMES } from "../../catalog/domain/constants/default-service-categories";
import { ServiceCategory } from "../../catalog/domain/entities/service-category";
import { CategoryName } from "../../catalog/domain/value-objects/category-name";
import { UniqueEntityId } from "../../../shared/entities/unique-entity-id";

export function createDefaultServiceCategories(
  establishmentId: UniqueEntityId,
): ServiceCategory[] {
  return DEFAULT_SERVICE_CATEGORY_NAMES.map((name) =>
    ServiceCategory.create({
      establishmentId,
      name: CategoryName.create(name),
    }),
  );
}
