import { CustomerVehicle } from "../../src/modules/customer/domain/entities/customer-vehicle";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";

type CustomerVehicleCreateProps = Parameters<typeof CustomerVehicle.create>[0];

export function makeCustomerVehicle(
  override?: Partial<CustomerVehicleCreateProps>,
  id?: UniqueEntityId,
) {
  const vehicle = CustomerVehicle.create(
    {
      establishmentId: new UniqueEntityId(),
      customerId: new UniqueEntityId(),
      plate: "ABC1D23",
      brand: "Toyota",
      model: "Corolla",
      color: "Prata",
      year: 2022,
      notes: null,
      ...override,
    },
    id,
  );

  return vehicle;
}
