import { Customer } from "../../../modules/customer/domain/entities/customer";
import { CustomerVehicle } from "../../../modules/customer/domain/entities/customer-vehicle";
import { CustomerVehiclePresenter } from "./customer-vehicle-presenter";

export class CustomerPresenter {
  static toHTTP(customer: Customer) {
    return {
      id: customer.id.toString(),
      establishmentId: customer.establishmentId.toString(),
      profileImageUrl: customer.profileImageUrl,
      cpfCnpj: customer.cpfCnpj?.toString() ?? null,
      documentType: customer.cpfCnpj?.type ?? null,
      fullName: customer.fullName,
      phone: customer.phone.toString(),
      email: customer.email.toString(),
      address: customer.address
        ? {
            street: customer.address.street,
            ...(customer.address.complement !== null
              ? { complement: customer.address.complement }
              : {}),
            country: customer.address.country,
            state: customer.address.state,
            zipCode: customer.address.zipCode,
            city: customer.address.city,
          }
        : null,
      birthDate: customer.birthDate?.toISOString() ?? null,
      nickname: customer.nickname,
      deletedAt: customer.deletedAt?.toISOString() ?? null,
      createdAt: customer.createdAt?.toISOString() ?? null,
      updatedAt: customer.updatedAt?.toISOString() ?? null,
    };
  }

  static toHTTPListItem(customer: Customer, vehicles: CustomerVehicle[]) {
    return {
      ...CustomerPresenter.toHTTP(customer),
      vehicles: vehicles.map((vehicle) =>
        CustomerVehiclePresenter.toHTTP(vehicle),
      ),
      vehiclesCount: vehicles.length,
    };
  }
}
