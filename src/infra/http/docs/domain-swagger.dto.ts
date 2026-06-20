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

export class EstablishmentDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "Clean Move",
    description: "Trade name (nome fantasia).",
  })
  tradeName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "Clean Move Servicos LTDA",
    description: "Legal business name (razão social).",
  })
  legalBusinessName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "61911322000187",
    description: "CNPJ digits only.",
  })
  cnpj!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "clean-move",
    description: "Public slug.",
  })
  slug!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "https://cdn.example.com/establishment-banner/uuid/banner.png",
    description:
      "Public banner image URL when set via POST /establishments/:establishmentId/banner-image.",
  })
  bannerImageUrl!: string | null;
}

export class GetEstablishmentResponseDto {
  @ApiProperty({ type: EstablishmentDto })
  establishment!: EstablishmentDto;
}

export class UpdateEstablishmentBodyDto {
  @ApiPropertyOptional({ example: "Clean Move" })
  tradeName?: string;

  @ApiPropertyOptional({ example: "Clean Move Servicos LTDA" })
  legalBusinessName?: string;

  @ApiPropertyOptional({ example: "61911322000187" })
  cnpj?: string;

  @ApiPropertyOptional({ example: "clean-move" })
  slug?: string;
}

export class UpdateEstablishmentResponseDto extends GetEstablishmentResponseDto {}

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

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: "Profile image URL from the linked User account.",
  })
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

  @ApiPropertyOptional({
    example: "11999999999",
    minLength: 1,
    nullable: true,
    description: "Optional customer phone number.",
  })
  phone?: string | null;

  @ApiPropertyOptional({
    example: "maria@example.com",
    format: "email",
    nullable: true,
    description: "Optional customer email address.",
  })
  email?: string | null;

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

  @ApiProperty({ type: String, example: "52998224725", nullable: true })
  cpfCnpj!: string | null;

  @ApiProperty({ enum: ["CPF", "CNPJ"], example: "CPF", nullable: true })
  documentType!: "CPF" | "CNPJ" | null;

  @ApiProperty({ example: "Maria Silva" })
  fullName!: string;

  @ApiProperty({ example: "11999999999", nullable: true })
  phone!: string | null;

  @ApiProperty({ example: "maria@example.com", nullable: true })
  email!: string | null;

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

export class OptionItemDto {
  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  id!: string;

  @ApiProperty({ example: "Maria Silva" })
  label!: string;
}

export class CustomerOptionsResponseDto {
  @ApiProperty({ type: OptionItemDto, isArray: true })
  customers!: OptionItemDto[];
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

  @ApiProperty({ type: String, example: null, nullable: true })
  imageUrl!: string | null;

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

export class CustomerListItemDto extends CustomerDto {
  @ApiProperty({ type: CustomerVehicleDto, isArray: true })
  vehicles!: CustomerVehicleDto[];

  @ApiProperty({
    example: 2,
    description: "Number of active vehicles associated with this customer.",
  })
  vehiclesCount!: number;
}

export class ListCustomersResponseDto {
  @ApiProperty({ type: CustomerListItemDto, isArray: true })
  customers!: CustomerListItemDto[];

  @ApiProperty({
    example: 42,
    description:
      "Total number of customers matching the current filters (across all pages).",
  })
  totalItems!: number;
}

export class CustomerVehicleResponseDto {
  @ApiProperty({ type: CustomerVehicleDto })
  vehicle!: CustomerVehicleDto;
}

export class ListCustomerVehiclesResponseDto {
  @ApiProperty({ type: CustomerVehicleDto, isArray: true })
  vehicles!: CustomerVehicleDto[];

  @ApiProperty({
    example: 7,
    description:
      "Total number of vehicles matching the current filters (across all pages).",
  })
  totalItems!: number;
}

export class CustomerVehicleOptionsResponseDto {
  @ApiProperty({ type: OptionItemDto, isArray: true })
  vehicles!: OptionItemDto[];
}

export class AppointmentServiceInputDto {
  @ApiProperty({ format: "uuid" })
  serviceId!: string;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  priceInCents?: number;
}

export class CreateAppointmentBodyDto {
  @ApiProperty({
    example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09",
    format: "uuid",
    description:
      "Active customer identifier owned by the authenticated establishment.",
  })
  customerId!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ["11cf3860-d512-47db-b9d1-c9044be6250d"],
    description:
      "Legacy service identifiers. Provide either serviceIds or services, not both.",
  })
  serviceIds?: string[];

  @ApiPropertyOptional({
    type: [AppointmentServiceInputDto],
    description:
      "Service items with optional charged prices. Provide either serviceIds or services, not both.",
  })
  services?: AppointmentServiceInputDto[];

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

export class UpdateAppointmentBodyDto {
  @ApiPropertyOptional({
    example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09",
    format: "uuid",
    description:
      "Active customer identifier owned by the authenticated establishment.",
  })
  customerId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ["11cf3860-d512-47db-b9d1-c9044be6250d"],
    description:
      "Legacy service identifiers. Provide either serviceIds or services, not both.",
  })
  serviceIds?: string[];

  @ApiPropertyOptional({
    type: [AppointmentServiceInputDto],
    description:
      "Service items with optional charged prices. Provide either serviceIds or services, not both.",
  })
  services?: AppointmentServiceInputDto[];

  @ApiPropertyOptional({
    type: String,
    example: "d4051bc0-3f48-4700-8208-ec64d1031618",
    nullable: true,
    format: "uuid",
    description:
      "Optional vehicle identifier. Send null to clear the appointment vehicle.",
  })
  vehicleId?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "2026-04-22T14:00:00.000Z",
    format: "date-time",
    description: "Appointment start date-time.",
  })
  startsAt?: string;

  @ApiPropertyOptional({
    type: String,
    example: "2026-04-22T14:45:00.000Z",
    nullable: true,
    format: "date-time",
    description:
      "Optional appointment end date-time. Send null to clear the end date.",
  })
  endsAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: "Cliente prefere lavagem externa.",
    nullable: true,
    description: "Send null or a blank string to clear the description.",
  })
  description?: string | null;

  @ApiPropertyOptional({
    type: Number,
    example: 500,
    nullable: true,
    minimum: 0,
    description:
      "Optional non-negative integer discount in cents. Send null to clear it.",
  })
  discountInCents?: number | null;
}

export class UpdateAppointmentStatusBodyDto {
  @ApiProperty({ enum: ["SCHEDULED", "DONE", "CANCELLED"] })
  status!: "SCHEDULED" | "DONE" | "CANCELLED";
}

export class AppointmentStatusUpdateDto {
  @ApiProperty({ example: "63f1d0ee-e8a4-47a8-8a73-0f3764b8731e" })
  id!: string;

  @ApiProperty({ enum: ["SCHEDULED", "DONE", "CANCELLED"] })
  status!: "SCHEDULED" | "DONE" | "CANCELLED";

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

export class UpdateAppointmentStatusResponseDto {
  @ApiProperty({ type: AppointmentStatusUpdateDto })
  appointment!: AppointmentStatusUpdateDto;
}

export class ServiceCategoryRefDto {
  @ApiProperty({
    example: "11cf3860-d512-47db-b9d1-c9044be6250d",
    format: "uuid",
  })
  id!: string;

  @ApiProperty({ example: "Lavagem" })
  name!: string;
}

export class AppointmentServiceDto {
  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  id!: string;

  @ApiProperty({ example: "Corte de cabelo" })
  name!: string;

  @ApiProperty({ type: ServiceCategoryRefDto, nullable: true })
  category!: ServiceCategoryRefDto | null;

  @ApiProperty({ type: Number, example: 45, nullable: true })
  durationInMinutes!: number | null;

  @ApiProperty({ example: 7500 })
  priceInCents!: number;

  @ApiProperty({
    enum: ["UNCHANGED", "UPDATED", "DELETED"],
    example: "UNCHANGED",
  })
  currentResourceStatus!: "UNCHANGED" | "UPDATED" | "DELETED";
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

  @ApiProperty({
    example: "Toyota Corolla 2022",
    nullable: true,
    description: "Derived display name built from brand, model, and year.",
  })
  displayName!: string | null;

  @ApiProperty({
    enum: ["UNCHANGED", "UPDATED", "DELETED"],
    example: "UNCHANGED",
  })
  currentResourceStatus!: "UNCHANGED" | "UPDATED" | "DELETED";
}

export class AppointmentCustomerSnapshotDto {
  @ApiProperty({ example: "Maria Silva" })
  fullName!: string;

  @ApiProperty({
    enum: ["UNCHANGED", "UPDATED", "DELETED"],
    example: "UNCHANGED",
  })
  currentResourceStatus!: "UNCHANGED" | "UPDATED" | "DELETED";
}

export class AppointmentDto {
  @ApiProperty({ example: "63f1d0ee-e8a4-47a8-8a73-0f3764b8731e" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  customerId!: string;

  @ApiProperty({ type: AppointmentCustomerSnapshotDto })
  customer!: AppointmentCustomerSnapshotDto;

  @ApiProperty({
    type: String,
    example: "d4051bc0-3f48-4700-8208-ec64d1031618",
    nullable: true,
    format: "uuid",
  })
  vehicleId!: string | null;

  @ApiProperty({ type: AppointmentServiceDto, isArray: true })
  services!: AppointmentServiceDto[];

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

  @ApiProperty({
    example: 24,
    description:
      "Total number of appointments matching the current filters (across all pages when pagination is used).",
  })
  totalItems!: number;
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

export class ServicePriceSpecificationDto {
  @ApiProperty({ enum: ["FIXED", "STARTING_AT", "RANGE"] })
  type!: "FIXED" | "STARTING_AT" | "RANGE";

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  fixedPriceInCents?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  minPriceInCents?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  maxPriceInCents?: number;
}

export class ServiceOptionItemDto {
  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  id!: string;

  @ApiProperty({ example: "Lavagem Completa" })
  label!: string;

  @ApiProperty({
    example: 3000,
    description: "Default charge price in cents for the service.",
  })
  priceInCents!: number;

  @ApiProperty({ type: ServicePriceSpecificationDto })
  priceSpecification!: ServicePriceSpecificationDto;
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
    example: "11cf3860-d512-47db-b9d1-c9044be6250d",
    format: "uuid",
    nullable: true,
    description: "Optional service category identifier.",
  })
  categoryId?: string | null;

  @ApiPropertyOptional({
    type: CreateServiceEstimatedDurationBodyDto,
    description: "Optional estimated duration range for the service.",
  })
  estimatedDuration?: CreateServiceEstimatedDurationBodyDto;

  @ApiPropertyOptional({
    example: 3000,
    description:
      "Legacy service price in cents. Provide either price or priceSpecification.",
  })
  price?: number;

  @ApiPropertyOptional({
    type: ServicePriceSpecificationDto,
    description:
      "Service price policy. Provide either price or priceSpecification.",
  })
  priceSpecification?: ServicePriceSpecificationDto;

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

  @ApiProperty({ type: ServiceCategoryRefDto, nullable: true })
  category!: ServiceCategoryRefDto | null;

  @ApiProperty({
    type: ServiceEstimatedDurationDto,
    nullable: true,
  })
  estimatedDuration!: ServiceEstimatedDurationDto | null;

  @ApiProperty({ example: 3000 })
  priceInCents!: number;

  @ApiProperty({ type: ServicePriceSpecificationDto })
  priceSpecification!: ServicePriceSpecificationDto;

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

export class CompleteOnboardingEstablishmentBodyDto {
  @ApiPropertyOptional({
    example: "Clean Move",
    description: "Optional establishment trade name.",
  })
  tradeName?: string;

  @ApiPropertyOptional({
    example: "Clean Move Servicos LTDA",
    description: "Optional establishment legal business name.",
  })
  legalBusinessName?: string;

  @ApiPropertyOptional({
    example: "61911322000187",
    description: "Optional establishment CNPJ.",
  })
  cnpj?: string;
}

export class CompleteOnboardingServiceEstimatedDurationBodyDto {
  @ApiPropertyOptional({
    example: 30,
    description:
      "Minimum estimated service duration in minutes. Required when any service data is provided.",
  })
  minInMinutes?: number;

  @ApiPropertyOptional({
    example: 60,
    description: "Optional maximum estimated service duration in minutes.",
  })
  maxInMinutes?: number;
}

export class CompleteOnboardingServiceBodyDto {
  @ApiPropertyOptional({
    example: "Lavagem premium",
    description: "Required when any service data is provided.",
  })
  serviceName?: string;

  @ApiPropertyOptional({
    example: "Lavagem externa com acabamento e brilho.",
    description: "Optional service description.",
  })
  description?: string;

  @ApiPropertyOptional({
    format: "uuid",
    example: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    description: "Required when any service data is provided.",
  })
  categoryId?: string;

  @ApiPropertyOptional({
    type: CompleteOnboardingServiceEstimatedDurationBodyDto,
    description:
      "Required with minInMinutes when any service data is provided.",
  })
  estimatedDuration?: CompleteOnboardingServiceEstimatedDurationBodyDto;

  @ApiPropertyOptional({
    example: 3000,
    description: "Required when any service data is provided. Price in cents.",
  })
  price?: number;

  @ApiPropertyOptional({
    example: true,
    description: "Whether the service is immediately available for booking.",
  })
  isActive?: boolean;
}

export class CompleteOnboardingCustomerBodyDto {
  @ApiPropertyOptional({
    type: String,
    example: "52998224725",
    nullable: true,
    description: "Optional CPF or CNPJ.",
  })
  cpfCnpj?: string | null;

  @ApiPropertyOptional({
    example: "Maria Silva",
    description: "Required when any customer data is provided.",
  })
  fullName?: string;

  @ApiPropertyOptional({
    example: "11999999999",
    description: "Required when any customer data is provided.",
  })
  phone?: string;

  @ApiPropertyOptional({
    example: "maria@example.com",
    format: "email",
    nullable: true,
    description: "Optional customer email address.",
  })
  email?: string | null;

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

export class CompleteOnboardingVehicleBodyDto {
  @ApiPropertyOptional({ example: "ABC-1D23", nullable: true })
  plate?: string | null;

  @ApiPropertyOptional({ example: "Toyota", nullable: true })
  brand?: string | null;

  @ApiPropertyOptional({ example: "Corolla", nullable: true })
  model?: string | null;

  @ApiPropertyOptional({ example: "Prata", nullable: true })
  color?: string | null;

  @ApiPropertyOptional({ example: 2022, nullable: true })
  year?: number | null;

  @ApiPropertyOptional({ example: "Veiculo principal", nullable: true })
  notes?: string | null;
}

export class CompleteOnboardingAppointmentBodyDto {
  @ApiPropertyOptional({
    type: String,
    example: "2026-04-22T14:00:00.000Z",
    format: "date-time",
    description:
      "Required when any appointment data is provided. The appointment uses the service and customer created in this onboarding request.",
  })
  startsAt?: string;

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

export class CompleteOnboardingBodyDto {
  @ApiPropertyOptional({
    type: CompleteOnboardingEstablishmentBodyDto,
    description:
      "Optional establishment data. Empty or omitted section is skipped.",
  })
  establishment?: CompleteOnboardingEstablishmentBodyDto;

  @ApiPropertyOptional({
    type: CompleteOnboardingServiceBodyDto,
    description:
      "Optional service data. Empty or omitted section is skipped; partial section requires serviceName, price, categoryId, and estimatedDuration.minInMinutes.",
  })
  service?: CompleteOnboardingServiceBodyDto;

  @ApiPropertyOptional({
    type: CompleteOnboardingCustomerBodyDto,
    description:
      "Optional customer data. Empty or omitted section is skipped; partial section requires fullName and phone.",
  })
  customer?: CompleteOnboardingCustomerBodyDto;

  @ApiPropertyOptional({
    type: CompleteOnboardingVehicleBodyDto,
    description:
      "Optional vehicle data. Requires customer data when any vehicle data is provided.",
  })
  vehicle?: CompleteOnboardingVehicleBodyDto;

  @ApiPropertyOptional({
    type: CompleteOnboardingAppointmentBodyDto,
    description:
      "Optional appointment data. Empty or omitted section is skipped; partial section requires startsAt, service data, and customer data in the same request.",
  })
  appointment?: CompleteOnboardingAppointmentBodyDto;
}

export class CompleteOnboardingSummaryDto {
  @ApiProperty({
    example: true,
    description: "Whether establishment commercial data was updated.",
  })
  establishmentUpdated!: boolean;

  @ApiProperty({
    example: true,
    description: "Whether a service was created.",
  })
  serviceCreated!: boolean;

  @ApiProperty({
    example: true,
    description: "Whether a customer was created.",
  })
  customerCreated!: boolean;

  @ApiProperty({
    example: true,
    description: "Whether a customer vehicle was created.",
  })
  vehicleCreated!: boolean;

  @ApiProperty({
    example: true,
    description: "Whether an appointment was created.",
  })
  appointmentCreated!: boolean;
}

export class CompleteOnboardingResponseDto {
  @ApiProperty({ type: CompleteOnboardingSummaryDto })
  onboarding!: CompleteOnboardingSummaryDto;
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
    example: "11cf3860-d512-47db-b9d1-c9044be6250d",
    format: "uuid",
    nullable: true,
    description: "Optional service category identifier. Use null to clear.",
  })
  categoryId?: string | null;

  @ApiPropertyOptional({
    type: UpdateServiceEstimatedDurationBodyDto,
    description: "Optional estimated duration range for the service.",
  })
  estimatedDuration?: UpdateServiceEstimatedDurationBodyDto;

  @ApiPropertyOptional({
    example: 3000,
    description:
      "Legacy service price in cents. Provide either price or priceSpecification.",
  })
  price?: number;

  @ApiPropertyOptional({
    type: ServicePriceSpecificationDto,
    description:
      "Service price policy. Provide either price or priceSpecification.",
  })
  priceSpecification?: ServicePriceSpecificationDto;

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

export class ServiceOptionsResponseDto {
  @ApiProperty({ type: ServiceOptionItemDto, isArray: true })
  services!: ServiceOptionItemDto[];
}

export class DashboardMetricsOverviewPointDto {
  @ApiProperty({
    example: "2026-05-12",
    description: "Bucket start date for this overview point.",
  })
  date!: string;

  @ApiProperty({
    example: "12/05",
    description: "Display label for the overview point bucket.",
  })
  label!: string;
}

export class DashboardMetricsOverviewCountPointDto extends DashboardMetricsOverviewPointDto {
  @ApiProperty({ example: 12 })
  value!: number;
}

export class DashboardMetricsOverviewMoneyPointDto extends DashboardMetricsOverviewPointDto {
  @ApiProperty({ example: 18650 })
  valueInCents!: number;
}

export class DashboardMetricsOverviewAppointmentsDto {
  @ApiProperty({ example: 256 })
  value!: number;

  @ApiProperty({
    example: 18,
    nullable: true,
    description:
      "Percentage change compared with the previous equivalent period.",
  })
  variationPercentage!: number | null;

  @ApiProperty({
    type: DashboardMetricsOverviewCountPointDto,
    isArray: true,
  })
  points!: DashboardMetricsOverviewCountPointDto[];
}

export class DashboardMetricsOverviewAverageTicketDto {
  @ApiProperty({ example: 18650 })
  valueInCents!: number;

  @ApiProperty({
    example: 9,
    nullable: true,
    description:
      "Percentage change compared with the previous equivalent period.",
  })
  variationPercentage!: number | null;

  @ApiProperty({
    type: DashboardMetricsOverviewMoneyPointDto,
    isArray: true,
  })
  points!: DashboardMetricsOverviewMoneyPointDto[];
}

export class DashboardMetricsOverviewCancellationRateDto {
  @ApiProperty({
    example: 4.2,
    description: "Cancellation rate percentage for the selected period.",
  })
  value!: number;

  @ApiProperty({
    example: -1.6,
    nullable: true,
    description:
      "Cancellation rate change in percentage points compared with the previous equivalent period.",
  })
  variationInPercentagePoints!: number | null;

  @ApiProperty({
    type: DashboardMetricsOverviewCountPointDto,
    isArray: true,
  })
  points!: DashboardMetricsOverviewCountPointDto[];
}

export class DashboardMetricsOverviewTotalRevenueDto {
  @ApiProperty({ example: 4738900 })
  valueInCents!: number;

  @ApiProperty({
    example: 21,
    nullable: true,
    description:
      "Percentage change compared with the previous equivalent period.",
  })
  variationPercentage!: number | null;

  @ApiProperty({
    type: DashboardMetricsOverviewMoneyPointDto,
    isArray: true,
  })
  points!: DashboardMetricsOverviewMoneyPointDto[];
}

export class DashboardMetricsOverviewResponseDto {
  @ApiProperty({ type: DashboardMetricsOverviewAppointmentsDto })
  appointments!: DashboardMetricsOverviewAppointmentsDto;

  @ApiProperty({ type: DashboardMetricsOverviewAverageTicketDto })
  averageTicket!: DashboardMetricsOverviewAverageTicketDto;

  @ApiProperty({ type: DashboardMetricsOverviewCancellationRateDto })
  cancellationRate!: DashboardMetricsOverviewCancellationRateDto;

  @ApiProperty({ type: DashboardMetricsOverviewTotalRevenueDto })
  totalRevenue!: DashboardMetricsOverviewTotalRevenueDto;
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
  @ApiProperty({
    example: "daily",
    enum: ["daily", "weekly", "monthly"],
    description:
      "Resolved bucket granularity used to build the revenue points.",
  })
  granularity!: "daily" | "weekly" | "monthly";

  @ApiProperty({ type: DashboardMetricsRevenuePointDto, isArray: true })
  points!: DashboardMetricsRevenuePointDto[];

  @ApiProperty({ type: DashboardMetricsRevenueSummaryDto })
  summary!: DashboardMetricsRevenueSummaryDto;
}

export class DashboardMetricsAppointmentsByStatusDto {
  @ApiProperty({
    example: 12,
    description: "Scheduled appointments for the selected period.",
  })
  scheduled!: number;

  @ApiProperty({
    example: 9,
    description: "Completed appointments for the selected period.",
  })
  done!: number;

  @ApiProperty({
    example: 3,
    description: "Cancelled appointments for the selected period.",
  })
  cancelled!: number;
}

export class DashboardMetricsAppointmentRatesDto {
  @ApiProperty({
    example: 37.5,
    description: "Completed appointments percentage for the selected period.",
  })
  completion!: number;

  @ApiProperty({
    example: 12.5,
    description: "Cancelled appointments percentage for the selected period.",
  })
  cancellation!: number;
}

export class DashboardMetricsAppointmentsResponseDto {
  @ApiProperty({
    example: 24,
    description: "Total appointments for the selected period.",
  })
  total!: number;

  @ApiProperty({ type: DashboardMetricsAppointmentsByStatusDto })
  byStatus!: DashboardMetricsAppointmentsByStatusDto;

  @ApiProperty({ type: DashboardMetricsAppointmentRatesDto })
  rates!: DashboardMetricsAppointmentRatesDto;
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

export class DashboardMetricsTopCustomerDto {
  @ApiProperty({
    example: 1,
    description: "Absolute ranking position in the filtered result.",
  })
  position!: number;

  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  customerId!: string;

  @ApiProperty({ example: "Ana Maria Souza" })
  customerName!: string;

  @ApiProperty({
    example: 8,
    description: "Number of DONE appointments in the selected period.",
  })
  completedAppointmentsCount!: number;

  @ApiProperty({
    example: 132000,
    description: "Total net spent in cents across DONE appointments.",
  })
  totalSpentInCents!: number;
}

export class DashboardMetricsTopCustomersResponseDto {
  @ApiProperty({ type: DashboardMetricsTopCustomerDto, isArray: true })
  customers!: DashboardMetricsTopCustomerDto[];

  @ApiProperty({
    example: 12,
    description: "Total ranked customers before pagination.",
  })
  totalCustomers!: number;
}

export class CreateServiceCategoryBodyDto {
  @ApiProperty({ example: "Polimento Especial" })
  name!: string;
}

export class UpdateServiceCategoryBodyDto {
  @ApiProperty({ example: "Polimento Premium" })
  name!: string;
}

export class ServiceCategoryDto {
  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "Lavagem" })
  name!: string;

  @ApiProperty({ example: null, nullable: true })
  deletedAt!: string | null;

  @ApiProperty({ example: "2026-04-22T14:00:00.000Z", nullable: true })
  createdAt!: string | null;

  @ApiProperty({ example: "2026-04-22T14:05:00.000Z", nullable: true })
  updatedAt!: string | null;
}

export class ServiceCategoryResponseDto {
  @ApiProperty({ type: ServiceCategoryDto })
  category!: ServiceCategoryDto;
}

export class ListServiceCategoriesResponseDto {
  @ApiProperty({ type: ServiceCategoryDto, isArray: true })
  categories!: ServiceCategoryDto[];
}

export class ServiceCategoryOptionDto {
  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  id!: string;

  @ApiProperty({ example: "Lavagem" })
  label!: string;
}

export class ServiceCategoryOptionsResponseDto {
  @ApiProperty({ type: ServiceCategoryOptionDto, isArray: true })
  categories!: ServiceCategoryOptionDto[];
}
