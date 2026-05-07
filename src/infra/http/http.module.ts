import { Module } from "@nestjs/common";
import { CreateAppointmentUseCase } from "../../modules/application/use-cases/appointment/create-appointment";
import { ListAppointmentsUseCase } from "../../modules/application/use-cases/appointment/list-appointments";
import { UpdateAppointmentStatusUseCase } from "../../modules/application/use-cases/appointment/update-appointment-status";
import { AuthenticateWithOAuthUseCase } from "../../modules/application/use-cases/auth/authenticate-with-oauth";
import { LoginWithCredentialsUseCase } from "../../modules/application/use-cases/auth/login-with-credentials";
import { RefreshSessionUseCase } from "../../modules/application/use-cases/auth/refresh-session";
import { SignOutUseCase } from "../../modules/application/use-cases/auth/sign-out";
import { CreateCustomerUseCase } from "../../modules/application/use-cases/customer/create-customer";
import { CreateCustomerVehicleUseCase } from "../../modules/application/use-cases/customer/create-customer-vehicle";
import { DeleteCustomerUseCase } from "../../modules/application/use-cases/customer/delete-customer";
import { DeleteCustomerVehicleUseCase } from "../../modules/application/use-cases/customer/delete-customer-vehicle";
import { ListCustomersUseCase } from "../../modules/application/use-cases/customer/list-customers";
import { ListCustomerVehiclesUseCase } from "../../modules/application/use-cases/customer/list-customer-vehicles";
import { UpdateCustomerUseCase } from "../../modules/application/use-cases/customer/update-customer";
import { UpdateCustomerVehicleUseCase } from "../../modules/application/use-cases/customer/update-customer-vehicle";
import { DeleteEmployeeUseCase } from "../../modules/application/use-cases/employee/delete-employee";
import { GetEmployeeUseCase } from "../../modules/application/use-cases/employee/get-employee";
import { ListEmployeesUseCase } from "../../modules/application/use-cases/employee/list-employees";
import { RegisterEmployeeUseCase } from "../../modules/application/use-cases/employee/register-employee";
import { UpdateEmployeeUseCase } from "../../modules/application/use-cases/employee/update-employee";
import { RegisterEstablishmentUseCase } from "../../modules/application/use-cases/establishment/register-establishment";
import { CreateServiceUseCase } from "../../modules/application/use-cases/service/create-service";
import { SessionCreationService } from "../../modules/accounts/domain/services/session-creation-service";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { AuthenticateWithGoogleController } from "./controllers/authenticate-with-google.controller";
import { CreateAppointmentController } from "./controllers/create-appointment.controller";
import { CreateCustomerController } from "./controllers/create-customer.controller";
import { CreateCustomerVehicleController } from "./controllers/create-customer-vehicle.controller";
import { CreateServiceController } from "./controllers/create-service.controller";
import { DeleteCustomerController } from "./controllers/delete-customer.controller";
import { DeleteCustomerVehicleController } from "./controllers/delete-customer-vehicle.controller";
import { DeleteEmployeeController } from "./controllers/delete-employee.controller";
import { GetEmployeeController } from "./controllers/get-employee.controller";
import { ListAppointmentsController } from "./controllers/list-appointments.controller";
import { ListCustomersController } from "./controllers/list-customers.controller";
import { ListCustomerVehiclesController } from "./controllers/list-customer-vehicles.controller";
import { ListEmployeesController } from "./controllers/list-employees.controller";
import { LoginWithCredentialsController } from "./controllers/login-with-credentials.controller";
import { SignOutController } from "./controllers/sign-out.controller";
import { RefreshSessionController } from "./controllers/refresh-session.controller";
import { RegisterEmployeeController } from "./controllers/register-employee.controller";
import { RegisterEstablishmentController } from "./controllers/register-establishment.controller";
import { UpdateAppointmentStatusController } from "./controllers/update-appointment-status.controller";
import { UpdateCustomerController } from "./controllers/update-customer.controller";
import { UpdateCustomerVehicleController } from "./controllers/update-customer-vehicle.controller";
import { UpdateEmployeeController } from "./controllers/update-employee.controller";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    RegisterEstablishmentController,
    AuthenticateWithGoogleController,
    LoginWithCredentialsController,
    RefreshSessionController,
    SignOutController,
    CreateServiceController,
    CreateCustomerController,
    ListCustomersController,
    UpdateCustomerController,
    DeleteCustomerController,
    CreateCustomerVehicleController,
    ListCustomerVehiclesController,
    UpdateCustomerVehicleController,
    DeleteCustomerVehicleController,
    CreateAppointmentController,
    ListAppointmentsController,
    UpdateAppointmentStatusController,
    RegisterEmployeeController,
    GetEmployeeController,
    ListEmployeesController,
    UpdateEmployeeController,
    DeleteEmployeeController,
  ],
  providers: [
    RegisterEstablishmentUseCase,
    AuthenticateWithOAuthUseCase,
    CreateServiceUseCase,
    CreateCustomerUseCase,
    ListCustomersUseCase,
    UpdateCustomerUseCase,
    DeleteCustomerUseCase,
    CreateCustomerVehicleUseCase,
    ListCustomerVehiclesUseCase,
    UpdateCustomerVehicleUseCase,
    DeleteCustomerVehicleUseCase,
    CreateAppointmentUseCase,
    ListAppointmentsUseCase,
    UpdateAppointmentStatusUseCase,
    RegisterEmployeeUseCase,
    GetEmployeeUseCase,
    ListEmployeesUseCase,
    UpdateEmployeeUseCase,
    DeleteEmployeeUseCase,
    LoginWithCredentialsUseCase,
    RefreshSessionUseCase,
    SignOutUseCase,
    SessionCreationService,
  ],
})
export class HttpModule {}
