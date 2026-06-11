import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";

export function makeServiceCategoryRef(
  name = "Lavagem",
  id = new UniqueEntityId(),
) {
  return {
    id,
    name,
  };
}
