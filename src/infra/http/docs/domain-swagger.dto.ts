import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ALLOWED_EMPLOYEE_FEATURES,
  ALLOWED_EXTRA_EMPLOYEE_FEATURES,
} from "../../../modules/employees/domain/policies/employee-features-policy";

export class AddressDto {
  @ApiProperty({ example: "Rua das Flores, 123" })
  street!: string;

  @ApiPropertyOptional({
    example: "Sala 12",
    description: "Optional address complement (e.g. apartment, suite).",
  })
  complement?: string | null;

  @ApiProperty({ example: "Brasil" })
  country!: string;

  @ApiProperty({ example: "SP" })
  state!: string;

  @ApiProperty({ example: "01001-000" })
  zipCode!: string;

  @ApiProperty({ example: "Sao Paulo" })
  city!: string;
}

export class RegisterEstablishmentBodyDto {
  @ApiProperty({ example: "Studio Clean Move" })
  name!: string;

  @ApiProperty({
    example: "Studio Clean Move",
    description: "Trade name (nome fantasia).",
  })
  tradeName!: string;

  @ApiProperty({
    example: "Studio Clean Move Servicos LTDA",
    description: "Legal business name (razão social).",
  })
  legalBusinessName!: string;

  @ApiProperty({ example: "contato@cleanmove.com" })
  email!: string;

  @ApiProperty({ example: "123456" })
  password!: string;

  @ApiProperty({ example: "12345678000199" })
  cnpj!: string;

  @ApiProperty({ example: "+5511988888888" })
  phone!: string;

  @ApiProperty({ type: AddressDto })
  address!: AddressDto;

  @ApiPropertyOptional({
    example: "studio-clean-move",
    description: "Optional public slug for the establishment.",
  })
  slug?: string;
}

export class RegisterEstablishmentResponseDto {
  @ApiProperty({
    example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84",
    description: "Created establishment identifier.",
  })
  establishmentId!: string;
}

export class RegisterEmployeeBodyDto {
  @ApiProperty({ example: "Ana Silva", minLength: 1 })
  name!: string;

  @ApiProperty({ example: "ana@example.com", format: "email" })
  email!: string;

  @ApiProperty({ example: "strong-password", maxLength: 72 })
  password!: string;

  @ApiPropertyOptional({
    type: String,
    example: "52998224725",
    nullable: true,
    description: "Optional employee CPF.",
  })
  cpf?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "1995-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
    description:
      "Optional birth date. Employees must be at least 18 years old.",
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    enum: ALLOWED_EXTRA_EMPLOYEE_FEATURES,
    isArray: true,
    example: ["create:appointments", "update:customers"],
    description:
      "Optional features beyond the default read permissions. Default read permissions are added automatically.",
  })
  extraFeatures?: string[];
}

export class EmployeeDto {
  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "b62c5971-4081-4d3d-8e5d-80722b926e4a" })
  userId!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  profileImageUrl!: string | null;

  @ApiProperty({ example: "Ana Silva" })
  name!: string;

  @ApiProperty({ type: String, example: "52998224725", nullable: true })
  cpf!: string | null;

  @ApiProperty({
    type: String,
    example: "1995-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  birthDate!: string | null;

  @ApiProperty({
    enum: ALLOWED_EMPLOYEE_FEATURES,
    isArray: true,
    example: [
      "read:appointments",
      "read:services",
      "read:customers",
      "create:appointments",
    ],
  })
  features!: string[];

  @ApiProperty({
    type: String,
    example: null,
    nullable: true,
    format: "date-time",
  })
  deletedAt!: string | null;

  @ApiProperty({
    type: String,
    example: "2026-05-04T10:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  createdAt!: string | null;

  @ApiProperty({
    type: String,
    example: "2026-05-04T10:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  updatedAt!: string | null;
}

export class RegisterEmployeeResponseDto {
  @ApiProperty({ type: EmployeeDto })
  employee!: EmployeeDto;
}

export class EmployeeResponseDto {
  @ApiProperty({ type: EmployeeDto })
  employee!: EmployeeDto;
}

export class ListEmployeesResponseDto {
  @ApiProperty({ type: EmployeeDto, isArray: true })
  employees!: EmployeeDto[];
}

export class UpdateEmployeeBodyDto {
  @ApiPropertyOptional({ example: "Ana Silva", minLength: 1 })
  name?: string;

  @ApiPropertyOptional({
    type: String,
    example: "1995-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
    description:
      "Optional birth date. Employees must be at least 18 years old when provided.",
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    enum: ALLOWED_EXTRA_EMPLOYEE_FEATURES,
    isArray: true,
    example: ["create:appointments", "update:employees:self"],
    description:
      "Optional business features. System-managed session features are not accepted.",
  })
  extraFeatures?: string[];
}

export class CreateCustomerBodyDto {
  @ApiPropertyOptional({
    type: String,
    example: "52998224725",
    nullable: true,
    description:
      "Optional CPF or CNPJ. Must be unique among active customers in the authenticated establishment when provided.",
  })
  cpfCnpj?: string | null;

  @ApiProperty({
    example: "Maria Silva",
    minLength: 1,
    description: "Customer full name.",
  })
  fullName!: string;

  @ApiProperty({
    example: "11999999999",
    minLength: 1,
    description: "Customer phone number.",
  })
  phone!: string;

  @ApiProperty({
    example: "maria@example.com",
    format: "email",
    description: "Customer email address.",
  })
  email!: string;

  @ApiPropertyOptional({
    type: AddressDto,
    nullable: true,
    description: "Optional customer address.",
  })
  address?: AddressDto | null;

  @ApiPropertyOptional({
    type: String,
    example: "1990-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
    description: "Optional customer birth date.",
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "Maria",
    nullable: true,
    description: "Optional customer nickname.",
  })
  nickname?: string | null;
}

export class UpdateCustomerBodyDto {
  @ApiPropertyOptional({
    type: String,
    example: "52998224725",
    nullable: true,
    description:
      "Optional CPF or CNPJ. Must be unique among active customers in the authenticated establishment when provided.",
  })
  cpfCnpj?: string | null;

  @ApiPropertyOptional({ example: "Maria Silva", minLength: 1 })
  fullName?: string;

  @ApiPropertyOptional({ example: "11999999999", minLength: 1 })
  phone?: string;

  @ApiPropertyOptional({ example: "maria@example.com", format: "email" })
  email?: string;

  @ApiPropertyOptional({ type: AddressDto, nullable: true })
  address?: AddressDto | null;

  @ApiPropertyOptional({
    type: String,
    example: "1990-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  birthDate?: string | null;

  @ApiPropertyOptional({ type: String, example: "Maria", nullable: true })
  nickname?: string | null;
}

export class CustomerDto {
  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ type: String, example: null, nullable: true })
  profileImageUrl!: string | null;

  @ApiProperty({ type: String, example: "52998224725", nullable: true })
  cpfCnpj!: string | null;

  @ApiProperty({ enum: ["CPF", "CNPJ"], example: "CPF", nullable: true })
  documentType!: "CPF" | "CNPJ" | null;

  @ApiProperty({ example: "Maria Silva" })
  fullName!: string;

  @ApiProperty({ example: "11999999999" })
  phone!: string;

  @ApiProperty({ example: "maria@example.com" })
  email!: string;

  @ApiProperty({ type: AddressDto, nullable: true })
  address!: AddressDto | null;

  @ApiProperty({
    type: String,
    example: "1990-01-01T00:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  birthDate!: string | null;

  @ApiProperty({ type: String, example: "Maria", nullable: true })
  nickname!: string | null;

  @ApiProperty({
    type: String,
    example: null,
    nullable: true,
    format: "date-time",
  })
  deletedAt!: string | null;

  @ApiProperty({
    type: String,
    example: "2026-04-20T10:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  createdAt!: string | null;

  @ApiProperty({
    type: String,
    example: "2026-04-20T10:05:00.000Z",
    nullable: true,
    format: "date-time",
  })
  updatedAt!: string | null;
}

export class CustomerResponseDto {
  @ApiProperty({ type: CustomerDto })
  customer!: CustomerDto;
}

export class ListCustomersResponseDto {
  @ApiProperty({ type: CustomerDto, isArray: true })
  customers!: CustomerDto[];
}

export class CreateCustomerVehicleBodyDto {
  @ApiPropertyOptional({
    type: String,
    example: "ABC1D23",
    nullable: true,
    description:
      "Optional vehicle plate. Non-alphanumeric characters are removed and the normalized plate must have exactly 7 characters. Must be unique among active vehicles in the authenticated establishment when provided.",
  })
  plate?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "Toyota",
    nullable: true,
    description: "Optional vehicle brand.",
  })
  brand?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "Corolla",
    nullable: true,
    description: "Optional vehicle model.",
  })
  model?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "Prata",
    nullable: true,
    description: "Optional vehicle color.",
  })
  color?: string | null;

  @ApiPropertyOptional({
    type: Number,
    example: 2022,
    nullable: true,
    minimum: 1900,
    description: "Optional vehicle model year. Must be an integer >= 1900.",
  })
  year?: number | null;

  @ApiPropertyOptional({
    type: String,
    example: "Veiculo principal",
    nullable: true,
    description: "Optional vehicle notes.",
  })
  notes?: string | null;
}

export class UpdateCustomerVehicleBodyDto extends CreateCustomerVehicleBodyDto {}

export class CustomerVehicleDto {
  @ApiProperty({ example: "d4051bc0-3f48-4700-8208-ec64d1031618" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  customerId!: string;

  @ApiProperty({ type: String, example: "ABC1D23", nullable: true })
  plate!: string | null;

  @ApiProperty({ type: String, example: "Toyota", nullable: true })
  brand!: string | null;

  @ApiProperty({ type: String, example: "Corolla", nullable: true })
  model!: string | null;

  @ApiProperty({ type: String, example: "Prata", nullable: true })
  color!: string | null;

  @ApiProperty({ type: Number, example: 2022, nullable: true, minimum: 1900 })
  year!: number | null;

  @ApiProperty({
    type: String,
    example: "Veiculo principal",
    nullable: true,
  })
  notes!: string | null;

  @ApiProperty({
    type: String,
    example: null,
    nullable: true,
    format: "date-time",
  })
  deletedAt!: string | null;

  @ApiProperty({
    type: String,
    example: "2026-04-20T10:00:00.000Z",
    nullable: true,
    format: "date-time",
  })
  createdAt!: string | null;

  @ApiProperty({
    type: String,
    example: "2026-04-20T10:05:00.000Z",
    nullable: true,
    format: "date-time",
  })
  updatedAt!: string | null;
}

export class CustomerVehicleResponseDto {
  @ApiProperty({ type: CustomerVehicleDto })
  vehicle!: CustomerVehicleDto;
}

export class ListCustomerVehiclesResponseDto {
  @ApiProperty({ type: CustomerVehicleDto, isArray: true })
  vehicles!: CustomerVehicleDto[];
}

export class CreateAppointmentBodyDto {
  @ApiProperty({
    example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09",
    format: "uuid",
    description:
      "Active customer identifier owned by the authenticated establishment.",
  })
  customerId!: string;

  @ApiProperty({
    example: "11cf3860-d512-47db-b9d1-c9044be6250d",
    format: "uuid",
    description:
      "Active service identifier owned by the authenticated establishment.",
  })
  serviceId!: string;

  @ApiPropertyOptional({
    type: String,
    example: "d4051bc0-3f48-4700-8208-ec64d1031618",
    nullable: true,
    format: "uuid",
    description:
      "Optional vehicle identifier. When provided, it must belong to the selected customer and establishment.",
  })
  vehicleId?: string | null;

  @ApiProperty({
    type: String,
    example: "2026-04-22T14:00:00.000Z",
    format: "date-time",
    description: "Required appointment start date-time.",
  })
  startsAt!: string;

  @ApiPropertyOptional({
    type: String,
    example: "2026-04-22T14:45:00.000Z",
    nullable: true,
    format: "date-time",
    description:
      "Optional appointment end date-time. When provided, it must be after startsAt.",
  })
  endsAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "Cliente prefere lavagem externa.",
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    type: Number,
    example: 500,
    nullable: true,
    minimum: 0,
    description: "Optional non-negative integer discount in cents.",
  })
  discountInCents?: number | null;
}

export class UpdateAppointmentStatusBodyDto {
  @ApiProperty({ enum: ["SCHEDULED", "DONE", "CANCELLED"] })
  status!: "SCHEDULED" | "DONE" | "CANCELLED";
}

export class AppointmentServiceDto {
  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  id!: string;

  @ApiProperty({ example: "Corte de cabelo" })
  name!: string;

  @ApiProperty({
    enum: [
      "WASH",
      "SANITIZATION",
      "AUTOMATIVE_DETAILING",
      "PROTECTION",
      "UPHOLSTERY",
    ],
    example: "WASH",
    nullable: true,
  })
  category!:
    | "WASH"
    | "SANITIZATION"
    | "AUTOMATIVE_DETAILING"
    | "PROTECTION"
    | "UPHOLSTERY"
    | null;

  @ApiProperty({ type: Number, example: 45, nullable: true })
  durationInMinutes!: number | null;

  @ApiProperty({ example: 7500 })
  priceInCents!: number;
}

export class AppointmentVehicleSnapshotDto {
  @ApiProperty({ type: String, example: "ABC1D23", nullable: true })
  plate!: string | null;

  @ApiProperty({ type: String, example: "Toyota", nullable: true })
  brand!: string | null;

  @ApiProperty({ type: String, example: "Corolla", nullable: true })
  model!: string | null;

  @ApiProperty({ type: String, example: "Prata", nullable: true })
  color!: string | null;

  @ApiProperty({ type: Number, example: 2022, nullable: true, minimum: 1900 })
  year!: number | null;
}

export class AppointmentDto {
  @ApiProperty({ example: "63f1d0ee-e8a4-47a8-8a73-0f3764b8731e" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  customerId!: string;

  @ApiProperty({
    type: String,
    example: "d4051bc0-3f48-4700-8208-ec64d1031618",
    nullable: true,
    format: "uuid",
  })
  vehicleId!: string | null;

  @ApiProperty({ type: AppointmentServiceDto })
  service!: AppointmentServiceDto;

  @ApiProperty({ type: AppointmentVehicleSnapshotDto, nullable: true })
  vehicle!: AppointmentVehicleSnapshotDto | null;

  @ApiProperty({
    type: String,
    example: "2026-04-22T14:00:00.000Z",
    format: "date-time",
  })
  startsAt!: string;

  @ApiProperty({
    type: String,
    example: "2026-04-22T14:45:00.000Z",
    nullable: true,
    format: "date-time",
  })
  endsAt!: string | null;

  @ApiProperty({
    type: String,
    example: "Cliente prefere lavagem externa.",
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    type: Number,
    example: 500,
    nullable: true,
    minimum: 0,
    description: "Applied non-negative integer discount in cents.",
  })
  discountInCents!: number | null;

  @ApiProperty({ enum: ["SCHEDULED", "DONE", "CANCELLED"] })
  status!: "SCHEDULED" | "DONE" | "CANCELLED";

  @ApiProperty({
    type: String,
    example: "2026-04-20T10:00:00.000Z",
    format: "date-time",
  })
  createdAt!: string;

  @ApiProperty({
    type: String,
    example: "2026-04-20T10:05:00.000Z",
    format: "date-time",
  })
  updatedAt!: string;

  @ApiProperty({
    type: String,
    example: null,
    nullable: true,
    format: "date-time",
  })
  doneAt!: string | null;

  @ApiProperty({
    type: String,
    example: null,
    nullable: true,
    format: "date-time",
  })
  cancelledAt!: string | null;
}

export class AppointmentResponseDto {
  @ApiProperty({ type: AppointmentDto })
  appointment!: AppointmentDto;
}

export class ListAppointmentsResponseDto {
  @ApiProperty({ type: AppointmentDto, isArray: true })
  appointments!: AppointmentDto[];
}

export class CreateServiceEstimatedDurationBodyDto {
  @ApiProperty({
    example: 30,
    description: "Minimum estimated service duration in minutes.",
  })
  minInMinutes!: number;

  @ApiPropertyOptional({
    example: 60,
    description: "Optional maximum estimated service duration in minutes.",
  })
  maxInMinutes?: number;
}

export class CreateServiceBodyDto {
  @ApiProperty({
    example: "Lavagem premium",
    description: "Service name shown to customers.",
  })
  serviceName!: string;

  @ApiPropertyOptional({
    example: "Lavagem externa com acabamento e brilho.",
    description: "Optional service description.",
  })
  description?: string;

  @ApiPropertyOptional({
    enum: [
      "WASH",
      "SANITIZATION",
      "AUTOMATIVE_DETAILING",
      "PROTECTION",
      "UPHOLSTERY",
    ],
    example: "WASH",
    description: "Optional category used to classify the service.",
  })
  category?:
    | "WASH"
    | "SANITIZATION"
    | "AUTOMATIVE_DETAILING"
    | "PROTECTION"
    | "UPHOLSTERY";

  @ApiPropertyOptional({
    type: CreateServiceEstimatedDurationBodyDto,
    description: "Optional estimated duration range for the service.",
  })
  estimatedDuration?: CreateServiceEstimatedDurationBodyDto;

  @ApiProperty({
    example: 3000,
    description: "Service price in cents.",
  })
  price!: number;

  @ApiPropertyOptional({
    example: true,
    description: "Whether the service is immediately available for booking.",
  })
  isActive?: boolean;
}

export class ServiceEstimatedDurationDto {
  @ApiProperty({
    example: 30,
    description: "Minimum estimated duration in minutes.",
  })
  minInMinutes!: number;

  @ApiProperty({
    example: 60,
    nullable: true,
    description: "Maximum estimated duration in minutes when defined.",
  })
  maxInMinutes!: number | null;
}

export class ServiceDto {
  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "Lavagem premium" })
  name!: string;

  @ApiProperty({
    example: "Lavagem externa com acabamento e brilho.",
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    enum: [
      "WASH",
      "SANITIZATION",
      "AUTOMATIVE_DETAILING",
      "PROTECTION",
      "UPHOLSTERY",
    ],
    example: "WASH",
    nullable: true,
  })
  category!:
    | "WASH"
    | "SANITIZATION"
    | "AUTOMATIVE_DETAILING"
    | "PROTECTION"
    | "UPHOLSTERY"
    | null;

  @ApiProperty({
    type: ServiceEstimatedDurationDto,
    nullable: true,
  })
  estimatedDuration!: ServiceEstimatedDurationDto | null;

  @ApiProperty({ example: 3000 })
  priceInCents!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: "2026-04-22T14:00:00.000Z", nullable: true })
  createdAt!: string | null;

  @ApiProperty({ example: "2026-04-22T14:05:00.000Z", nullable: true })
  updatedAt!: string | null;
}

export class CreateServiceResponseDto {
  @ApiProperty({ type: ServiceDto })
  service!: ServiceDto;
}

export class UpdateServiceEstimatedDurationBodyDto {
  @ApiProperty({
    example: 30,
    description: "Minimum estimated service duration in minutes.",
  })
  minInMinutes!: number;

  @ApiPropertyOptional({
    example: 60,
    description: "Optional maximum estimated service duration in minutes.",
  })
  maxInMinutes?: number;
}

export class UpdateServiceBodyDto {
  @ApiPropertyOptional({
    example: "Lavagem premium",
    description: "Service name shown to customers.",
  })
  serviceName?: string;

  @ApiPropertyOptional({
    example: "Lavagem externa com acabamento e brilho.",
    description: "Optional service description.",
  })
  description?: string;

  @ApiPropertyOptional({
    enum: [
      "WASH",
      "SANITIZATION",
      "AUTOMATIVE_DETAILING",
      "PROTECTION",
      "UPHOLSTERY",
    ],
    example: "WASH",
    description: "Optional category used to classify the service.",
  })
  category?:
    | "WASH"
    | "SANITIZATION"
    | "AUTOMATIVE_DETAILING"
    | "PROTECTION"
    | "UPHOLSTERY";

  @ApiPropertyOptional({
    type: UpdateServiceEstimatedDurationBodyDto,
    description: "Optional estimated duration range for the service.",
  })
  estimatedDuration?: UpdateServiceEstimatedDurationBodyDto;

  @ApiPropertyOptional({
    example: 3000,
    description: "Service price in cents.",
  })
  price?: number;

  @ApiPropertyOptional({
    example: false,
    description: "Whether the service is available for booking.",
  })
  isActive?: boolean;
}

export class UpdateServiceResponseDto {
  @ApiProperty({ type: ServiceDto })
  service!: ServiceDto;
}

export class ListServicesResponseDto {
  @ApiProperty({ type: ServiceDto, isArray: true })
  items!: ServiceDto[];

  @ApiProperty({
    example: 42,
    description:
      "Total number of services matching the current filters (across all pages).",
  })
  totalItems!: number;
}

export class DashboardMetricsOverviewResponseDto {
  @ApiProperty({ example: 56000 })
  totalRevenueInCents!: number;

  @ApiProperty({ example: 14000 })
  averageTicketInCents!: number;

  @ApiProperty({ example: 4 })
  appointmentsCount!: number;

  @ApiProperty({
    example: 0.25,
    description: "Cancelled appointments divided by filtered appointments.",
  })
  cancellationRate!: number;
}

export class DashboardMetricsRevenuePointDto {
  @ApiProperty({
    example: "2026-04-01",
    description: "Bucket start date for this revenue point.",
  })
  date!: string;

  @ApiProperty({
    example: "Apr 1",
    description: "Display label for the revenue bucket.",
  })
  label!: string;

  @ApiProperty({ example: 21000 })
  revenueInCents!: number;

  @ApiProperty({ example: 2 })
  appointments!: number;
}

export class DashboardMetricsRevenueSummaryDto {
  @ApiProperty({
    example: 56000,
    description: "Total revenue in cents for the selected period.",
  })
  revenueInCents!: number;

  @ApiProperty({
    example: 4,
    description: "Total appointments for the selected period.",
  })
  appointments!: number;

  @ApiProperty({
    example: 12.5,
    nullable: true,
    description:
      "Revenue trend percentage compared with the previous equivalent period.",
  })
  revenueTrendPercent!: number | null;

  @ApiProperty({
    example: -5,
    nullable: true,
    description:
      "Appointment trend percentage compared with the previous equivalent period.",
  })
  appointmentsTrendPercent!: number | null;
}

export class DashboardMetricsRevenueResponseDto {
  @ApiProperty({ type: DashboardMetricsRevenuePointDto, isArray: true })
  points!: DashboardMetricsRevenuePointDto[];

  @ApiProperty({ type: DashboardMetricsRevenueSummaryDto })
  summary!: DashboardMetricsRevenueSummaryDto;
}

export class DashboardMetricsCancellationRateDto {
  @ApiProperty({
    example: 25,
    description: "Cancellation rate percentage for the selected period.",
  })
  currentPercent!: number;

  @ApiProperty({
    example: 4.5,
    nullable: true,
    description:
      "Cancellation rate change in percentage points compared with the previous equivalent period.",
  })
  comparisonPercentPoints!: number | null;
}

export class DashboardMetricsAppointmentsResponseDto {
  @ApiProperty({
    example: 4,
    description: "Total appointments for the selected period.",
  })
  appointmentsCount!: number;

  @ApiProperty({ type: DashboardMetricsCancellationRateDto })
  cancellationRate!: DashboardMetricsCancellationRateDto;
}

export class DashboardMetricsPopularServiceDto {
  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  id!: string;

  @ApiProperty({ example: "Lavagem completa" })
  name!: string;

  @ApiProperty({
    example: 3,
    description:
      "Number of matching appointment service usages for this service.",
  })
  completedCount!: number;

  @ApiProperty({
    example: 75,
    description: "Percentage share among matching service usages.",
  })
  percent!: number;
}

export class DashboardMetricsPopularServicesResponseDto {
  @ApiProperty({ type: DashboardMetricsPopularServiceDto, isArray: true })
  popularServices!: DashboardMetricsPopularServiceDto[];

  @ApiProperty({
    example: 4,
    description:
      "Total number of service usages matching the selected filters.",
  })
  totalServices!: number;
}
