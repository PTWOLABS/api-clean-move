import { Customer } from "../../../modules/customer/domain/entities/customer";

export class CustomerPresenter {
  static toHTTP(customer: Customer) {
    return {
      id: customer.id.toString(),
      establishmentId: customer.establishmentId.toString(),
      cpfCnpj: customer.cpfCnpj?.toString() ?? null,
      documentType: customer.cpfCnpj?.type ?? null,
      fullName: customer.fullName,
      phone: customer.phone.toString(),
      email: customer.email.toString(),
      address: customer.address
        ? {
            street: customer.address.street,
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
}
