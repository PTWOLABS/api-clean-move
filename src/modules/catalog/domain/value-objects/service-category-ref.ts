import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export type ServiceCategoryRef = {
  id: UniqueEntityId;
  name: string;
};

export type ServiceCategorySnapshot = ServiceCategoryRef;
