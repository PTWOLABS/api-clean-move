import { Module } from "@nestjs/common";

import { CreateAppointmentUseCase } from "../../modules/application/use-cases/appointment/create-appointment";
import { ListAppointmentsUseCase } from "../../modules/application/use-cases/appointment/list-appointments";
import { UpdateAppointmentStatusUseCase } from "../../modules/application/use-cases/appointment/update-appointment-status";
import { AuthenticateWithOAuthUseCase } from "../../modules/application/use-cases/auth/authenticate-with-oauth";
import { CreateAuthSessionUseCase } from "../../modules/application/use-cases/auth/create-auth-session";
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
import { GetEstablishmentAppointmentsCountUseCase } from "../../modules/application/use-cases/establishment/get-establishment-appointments-count";
import { GetEstablishmentCancellationRateUseCase } from "../../modules/application/use-cases/establishment/get-establishment-cancellation-rate";
import { GetEstablishmentDashboardOverviewUseCase } from "../../modules/application/use-cases/establishment/get-establishment-dashboard-overview";
import { GetEstablishmentPopularServicesByCategoryUseCase } from "../../modules/application/use-cases/establishment/get-establishment-popular-services-by-category";
import { GetEstablishmentRevenueVsAppointmentsUseCase } from "../../modules/application/use-cases/establishment/get-establishment-revenue-vs-appointments";
import { RegisterEstablishmentUseCase } from "../../modules/application/use-cases/establishment/register-establishment";
import { UploadDomainImageUseCase } from "../../modules/application/use-cases/media/upload-domain-image";
import { CreateServiceUseCase } from "../../modules/application/use-cases/service/create-service";
import { ListAllServicesUseCase } from "../../modules/application/use-cases/service/list-all-services";
import { ListEstablishmentServicesUseCase } from "../../modules/application/use-cases/service/list-establishment-services";
import { UpdateServiceUseCase } from "../../modules/application/use-cases/service/update-service";
import { DeleteServiceUseCase } from "../../modules/application/use-cases/service/delete-service";
import { GetMeUseCase } from "../../modules/application/use-cases/user/get-me";
import { SessionCreationService } from "../../modules/accounts/domain/services/session-creation-service";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { StorageModule } from "../storage/storage.module";
import { AuthenticateWithGoogleController } from "./controllers/authenticate-with-google.controller";
import { CreateAppointmentController } from "./controllers/create-appointment.controller";
import { CreateCustomerController } from "./controllers/create-customer.controller";
import { CreateCustomerVehicleController } from "./controllers/create-customer-vehicle.controller";
import { CreateServiceController } from "./controllers/create-service.controller";
import { ListAllServicesController } from "./controllers/list-all-services.controller";
import { ListEstablishmentServicesController } from "./controllers/list-establishment-services.controller";
import { UpdateServiceController } from "./controllers/update-service.controller";
import { DeleteServiceController } from "./controllers/delete-service.controller";
import { DashboardMetricsAppointmentsController } from "./controllers/dashboard-metrics-appointments.controller";
import { DashboardMetricsOverviewController } from "./controllers/dashboard-metrics-overview.controller";
import { DashboardMetricsPopularServicesController } from "./controllers/dashboard-metrics-popular-services.controller";
import { DashboardMetricsRevenueController } from "./controllers/dashboard-metrics-revenue.controller";
import { DeleteCustomerController } from "./controllers/delete-customer.controller";
import { DeleteCustomerVehicleController } from "./controllers/delete-customer-vehicle.controller";
import { DeleteEmployeeController } from "./controllers/delete-employee.controller";
import { GetEmployeeController } from "./controllers/get-employee.controller";
import { GetMeController } from "./controllers/get-me.controller";
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
import { UploadCustomerProfileImageController } from "./controllers/media/upload-customer-profile-image.controller";
import { UploadEmployeeProfileImageController } from "./controllers/media/upload-employee-profile-image.controller";
import { UploadEstablishmentBannerImageController } from "./controllers/media/upload-establishment-banner-image.controller";
import { UploadVehicleImageController } from "./controllers/media/upload-vehicle-image.controller";

@Module({
  imports: [AuthModule, DatabaseModule, StorageModule],
  controllers: [
    RegisterEstablishmentController,
    AuthenticateWithGoogleController,
    LoginWithCredentialsController,
    RefreshSessionController,
    SignOutController,
    GetMeController,
    ListEstablishmentServicesController,
    ListAllServicesController,
    CreateServiceController,
    UpdateServiceController,
    DeleteServiceController,
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
    DashboardMetricsOverviewController,
    DashboardMetricsRevenueController,
    DashboardMetricsAppointmentsController,
    DashboardMetricsPopularServicesController,
    RegisterEmployeeController,
    GetEmployeeController,
    ListEmployeesController,
    UpdateEmployeeController,
    DeleteEmployeeController,
    UploadEmployeeProfileImageController,
    UploadCustomerProfileImageController,
    UploadVehicleImageController,
    UploadEstablishmentBannerImageController,
  ],
  providers: [
    RegisterEstablishmentUseCase,
    AuthenticateWithOAuthUseCase,
    CreateServiceUseCase,
    ListAllServicesUseCase,
    ListEstablishmentServicesUseCase,
    UpdateServiceUseCase,
    DeleteServiceUseCase,
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
    GetEstablishmentDashboardOverviewUseCase,
    GetEstablishmentAppointmentsCountUseCase,
    GetEstablishmentCancellationRateUseCase,
    GetEstablishmentRevenueVsAppointmentsUseCase,
    GetEstablishmentPopularServicesByCategoryUseCase,
    RegisterEmployeeUseCase,
    GetEmployeeUseCase,
    ListEmployeesUseCase,
    UpdateEmployeeUseCase,
    DeleteEmployeeUseCase,
    UploadDomainImageUseCase,
    CreateAuthSessionUseCase,
    LoginWithCredentialsUseCase,
    RefreshSessionUseCase,
    SignOutUseCase,
    GetMeUseCase,
    SessionCreationService,
  ],
})
export class HttpModule {}
