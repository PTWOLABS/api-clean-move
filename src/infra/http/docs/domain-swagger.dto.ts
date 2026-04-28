import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AddressDto {
  @ApiProperty({ example: "Rua das Flores, 123" })
  street!: string;

  @ApiProperty({ example: "Brasil" })
  country!: string;

  @ApiProperty({ example: "SP" })
  state!: string;

  @ApiProperty({ example: "01001-000" })
  zipCode!: string;

  @ApiProperty({ example: "Sao Paulo" })
  city!: string;
}

export class TimeRangeDto {
  @ApiProperty({ example: "08:00" })
  start!: string;

  @ApiProperty({ example: "18:00" })
  end!: string;
}

export class OperatingHoursDayDto {
  @ApiProperty({
    enum: [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ],
    example: "MONDAY",
  })
  day!:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";

  @ApiProperty({ type: TimeRangeDto, isArray: true })
  ranges!: TimeRangeDto[];
}

export class OperatingHoursDto {
  @ApiProperty({ type: OperatingHoursDayDto, isArray: true })
  days!: OperatingHoursDayDto[];
}

export class RegisterEstablishmentBodyDto {
  @ApiProperty({ example: "Studio Clean Move" })
  name!: string;

  @ApiProperty({ example: "Studio Clean Move LTDA" })
  corporateName!: string;

  @ApiProperty({ example: "Studio Clean Move Servicos de Beleza" })
  socialReason!: string;

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

  @ApiProperty({ type: OperatingHoursDto })
  operatingHours!: OperatingHoursDto;

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

export class CreateCustomerBodyDto {
  @ApiPropertyOptional({ example: "52998224725", nullable: true })
  cpfCnpj?: string | null;

  @ApiProperty({ example: "Maria Silva" })
  fullName!: string;

  @ApiProperty({ example: "11999999999" })
  phone!: string;

  @ApiProperty({ example: "maria@example.com" })
  email!: string;

  @ApiPropertyOptional({ type: AddressDto, nullable: true })
  address?: AddressDto | null;

  @ApiPropertyOptional({ example: "1990-01-01T00:00:00.000Z", nullable: true })
  birthDate?: string | null;

  @ApiPropertyOptional({ example: "Maria", nullable: true })
  nickname?: string | null;
}

export class UpdateCustomerBodyDto {
  @ApiPropertyOptional({ example: "52998224725", nullable: true })
  cpfCnpj?: string | null;

  @ApiPropertyOptional({ example: "Maria Silva" })
  fullName?: string;

  @ApiPropertyOptional({ example: "11999999999" })
  phone?: string;

  @ApiPropertyOptional({ example: "maria@example.com" })
  email?: string;

  @ApiPropertyOptional({ type: AddressDto, nullable: true })
  address?: AddressDto | null;

  @ApiPropertyOptional({ example: "1990-01-01T00:00:00.000Z", nullable: true })
  birthDate?: string | null;

  @ApiPropertyOptional({ example: "Maria", nullable: true })
  nickname?: string | null;
}

export class CustomerDto {
  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "52998224725", nullable: true })
  cpfCnpj!: string | null;

  @ApiProperty({ example: "CPF", nullable: true })
  documentType!: "CPF" | "CNPJ" | null;

  @ApiProperty({ example: "Maria Silva" })
  fullName!: string;

  @ApiProperty({ example: "11999999999" })
  phone!: string;

  @ApiProperty({ example: "maria@example.com" })
  email!: string;

  @ApiProperty({ type: AddressDto, nullable: true })
  address!: AddressDto | null;

  @ApiProperty({ example: "1990-01-01T00:00:00.000Z", nullable: true })
  birthDate!: string | null;

  @ApiProperty({ example: "Maria", nullable: true })
  nickname!: string | null;

  @ApiProperty({ example: null, nullable: true })
  deletedAt!: string | null;

  @ApiProperty({ example: "2026-04-20T10:00:00.000Z", nullable: true })
  createdAt!: string | null;

  @ApiProperty({ example: "2026-04-20T10:05:00.000Z", nullable: true })
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
  @ApiPropertyOptional({ example: "ABC1D23", nullable: true })
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

export class UpdateCustomerVehicleBodyDto extends CreateCustomerVehicleBodyDto {}

export class CustomerVehicleDto {
  @ApiProperty({ example: "d4051bc0-3f48-4700-8208-ec64d1031618" })
  id!: string;

  @ApiProperty({ example: "2e11b57c-b96a-490a-9ae6-64ef2966fd84" })
  establishmentId!: string;

  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  customerId!: string;

  @ApiProperty({ example: "ABC1D23", nullable: true })
  plate!: string | null;

  @ApiProperty({ example: "Toyota", nullable: true })
  brand!: string | null;

  @ApiProperty({ example: "Corolla", nullable: true })
  model!: string | null;

  @ApiProperty({ example: "Prata", nullable: true })
  color!: string | null;

  @ApiProperty({ example: 2022, nullable: true })
  year!: number | null;

  @ApiProperty({ example: "Veiculo principal", nullable: true })
  notes!: string | null;

  @ApiProperty({ example: null, nullable: true })
  deletedAt!: string | null;

  @ApiProperty({ example: "2026-04-20T10:00:00.000Z", nullable: true })
  createdAt!: string | null;

  @ApiProperty({ example: "2026-04-20T10:05:00.000Z", nullable: true })
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
  @ApiProperty({ example: "5f588c8b-ef0f-4193-aec0-2926e77c1d09" })
  customerId!: string;

  @ApiProperty({ example: "11cf3860-d512-47db-b9d1-c9044be6250d" })
  serviceId!: string;

  @ApiPropertyOptional({
    example: "d4051bc0-3f48-4700-8208-ec64d1031618",
    nullable: true,
  })
  vehicleId?: string | null;

  @ApiProperty({ example: "2026-04-22T14:00:00.000Z" })
  startsAt!: string;

  @ApiPropertyOptional({ example: "2026-04-22T14:45:00.000Z", nullable: true })
  endsAt?: string | null;

  @ApiPropertyOptional({
    example: "Cliente prefere lavagem externa.",
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({ example: 500, nullable: true })
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

  @ApiProperty({ example: "HAIR", nullable: true })
  category!: string | null;

  @ApiProperty({ example: 45, nullable: true })
  durationInMinutes!: number | null;

  @ApiProperty({ example: 7500 })
  priceInCents!: number;
}

export class AppointmentVehicleSnapshotDto {
  @ApiProperty({ example: "ABC1D23", nullable: true })
  plate!: string | null;

  @ApiProperty({ example: "Toyota", nullable: true })
  brand!: string | null;

  @ApiProperty({ example: "Corolla", nullable: true })
  model!: string | null;

  @ApiProperty({ example: "Prata", nullable: true })
  color!: string | null;

  @ApiProperty({ example: 2022, nullable: true })
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
    example: "d4051bc0-3f48-4700-8208-ec64d1031618",
    nullable: true,
  })
  vehicleId!: string | null;

  @ApiProperty({ type: AppointmentServiceDto })
  service!: AppointmentServiceDto;

  @ApiProperty({ type: AppointmentVehicleSnapshotDto, nullable: true })
  vehicle!: AppointmentVehicleSnapshotDto | null;

  @ApiProperty({ example: "2026-04-22T14:00:00.000Z" })
  startsAt!: string;

  @ApiProperty({ example: "2026-04-22T14:45:00.000Z", nullable: true })
  endsAt!: string | null;

  @ApiProperty({ example: "Cliente prefere lavagem externa.", nullable: true })
  description!: string | null;

  @ApiProperty({ example: 500, nullable: true })
  discountInCents!: number | null;

  @ApiProperty({ enum: ["SCHEDULED", "DONE", "CANCELLED"] })
  status!: "SCHEDULED" | "DONE" | "CANCELLED";

  @ApiProperty({ example: "2026-04-20T10:00:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-04-20T10:05:00.000Z" })
  updatedAt!: string;

  @ApiProperty({ example: null, nullable: true })
  doneAt!: string | null;

  @ApiProperty({ example: null, nullable: true })
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
