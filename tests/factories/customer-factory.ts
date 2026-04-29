import {
  Customer,
  CustomerProps,
} from "../../src/modules/customer/domain/entities/customer";
import { Email } from "../../src/modules/accounts/domain/value-objects/email";
import { Phone } from "../../src/modules/accounts/domain/value-objects/phone";
import { CustomerDocument } from "../../src/modules/customer/domain/value-objects/customer-document";
import { PrismaCustomerMapper } from "../../src/infra/database/prisma/mappers/prisma-customer-mapper";
import { PrismaService } from "../../src/infra/database/prisma/prisma.service";
import { UniqueEntityId } from "../../src/shared/entities/unique-entity-id";

export function makeCustomer(
  override?: Partial<CustomerProps>,
  id?: UniqueEntityId,
) {
  const customer = Customer.create(
    {
      establishmentId: new UniqueEntityId(),
      cpfCnpj: CustomerDocument.create("52998224725"),
      fullName: "Maria Silva",
      phone: Phone.create("11999999999"),
      email: new Email("maria@example.com"),
      address: null,
      birthDate: null,
      nickname: null,
      ...override,
    },
    id,
  );

  return customer;
}

export class CustomerFactory {
  constructor(private prisma: PrismaService) {}

  async makePrismaCustomer(
    override?: Partial<CustomerProps>,
    id?: UniqueEntityId,
  ) {
    const customer = makeCustomer(override, id);

    await this.prisma.customer.create({
      data: PrismaCustomerMapper.toPrisma(customer),
    });

    return customer;
  }
}
