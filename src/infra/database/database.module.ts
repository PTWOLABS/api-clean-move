import { Global, Module } from "@nestjs/common";

import { AppointmentsRepository } from "../../modules/application/repositories/appointments-repository";
import { CustomerVehiclesRepository } from "../../modules/application/repositories/customer-vehicles-repository";
import { CustomersRepository } from "../../modules/application/repositories/customers-repository";
import { EmployeesRepository } from "../../modules/application/repositories/employees-repository";
import { EstablishmentsRepository } from "../../modules/application/repositories/establishment-repository";
import { ServicesRepository } from "../../modules/application/repositories/services-repository";
import { UnitOfWork } from "../../modules/application/repositories/unit-of-work";
import { UsersRepository } from "../../modules/application/repositories/users-repository";
import { EnvModule } from "../env/env.module";
import { PrismaAppointmentsRepository } from "./prisma/repositories/prisma-appointments-repository";
import { PrismaService } from "./prisma/prisma.service";
import { PrismaCustomerVehiclesRepository } from "./prisma/repositories/prisma-customer-vehicles-repository";
import { PrismaEstablishmentRepository } from "./prisma/repositories/prisma-establishments-repository";
import { PrismaCustomersRepository } from "./prisma/repositories/prisma-customers-repository";
import { PrismaEmployeesRepository } from "./prisma/repositories/prisma-employees-repository";
import { PrismaServicesRepository } from "./prisma/repositories/prisma-services-repository";
import { PrismaUsersRepository } from "./prisma/repositories/prisma-users-repository";
import { PrismaUnitOfWork } from "./prisma/prisma-unit-of-work";
import { SessionsRepository } from "../../modules/application/repositories/sessions-repository";
import { PrismaSessionsRepository } from "./prisma/repositories/prisma-sessions-repository";

@Global()
@Module({
  imports: [EnvModule],
  providers: [
    PrismaService,
    {
      provide: UnitOfWork,
      useClass: PrismaUnitOfWork,
    },
    {
      provide: EstablishmentsRepository,
      useClass: PrismaEstablishmentRepository,
    },
    {
      provide: UsersRepository,
      useClass: PrismaUsersRepository,
    },
    {
      provide: CustomersRepository,
      useClass: PrismaCustomersRepository,
    },
    {
      provide: CustomerVehiclesRepository,
      useClass: PrismaCustomerVehiclesRepository,
    },
    {
      provide: ServicesRepository,
      useClass: PrismaServicesRepository,
    },
    {
      provide: AppointmentsRepository,
      useClass: PrismaAppointmentsRepository,
    },
    {
      provide: EmployeesRepository,
      useClass: PrismaEmployeesRepository,
    },
    {
      provide: SessionsRepository,
      useClass: PrismaSessionsRepository,
    },
  ],
  exports: [
    PrismaService,
    UnitOfWork,
    EstablishmentsRepository,
    UsersRepository,
    SessionsRepository,
    CustomersRepository,
    CustomerVehiclesRepository,
    ServicesRepository,
    AppointmentsRepository,
    EmployeesRepository,
  ],
})
export class DatabaseModule {}
