import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { AddressDto } from "./domain-swagger.dto";

export class UserSocialAccountResponseDto {
  @ApiProperty({ example: "GOOGLE", enum: ["GOOGLE"] })
  provider!: string;

  @ApiProperty({ example: "103954438723192847328" })
  subjectId!: string;
}

export class GetMeUserResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "John Doe" })
  name!: string;

  @ApiProperty({ example: "john@example.com", format: "email" })
  email!: string;

  @ApiProperty({
    enum: ["CUSTOMER", "ESTABLISHMENT", "ADMIN", "EMPLOYEE"],
    example: "CUSTOMER",
  })
  role!: string;

  @ApiProperty({
    type: String,
    format: "uuid",
    nullable: true,
    example: null,
    description:
      "Establishment id when role is ESTABLISHMENT (owner) or EMPLOYEE.",
  })
  establishmentId!: string | null;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
    example: null,
    description:
      "When the scoped establishment completed onboarding. Null when incomplete or unavailable.",
  })
  onboardingCompletedAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "https://cdn.example.com/user-profile/avatar.png",
    description: "User profile image URL when set via profile upload.",
  })
  profileImageUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "11988887777",
    description: "Normalized digits-only phone when set.",
  })
  phone?: string | null;

  @ApiPropertyOptional({
    type: AddressDto,
    nullable: true,
    description: "User address when the profile includes it.",
  })
  address?: AddressDto | null;

  @ApiProperty({ type: [UserSocialAccountResponseDto] })
  socialAccounts!: UserSocialAccountResponseDto[];

  @ApiProperty({
    example: true,
    description: "True when phone and address are both set.",
  })
  profileComplete!: boolean;

  @ApiProperty({
    example: true,
    description: "True when the user has a password set.",
  })
  hasPassword!: boolean;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
  })
  createdAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    nullable: true,
  })
  updatedAt?: string | null;
}

export class GetMeResponseDto {
  @ApiProperty({ type: GetMeUserResponseDto })
  user!: GetMeUserResponseDto;
}

export class UpdateUserBodyDto {
  @ApiPropertyOptional({ example: "Maria Silva" })
  name?: string;

  @ApiPropertyOptional({ example: "maria@example.com", format: "email" })
  email?: string;

  @ApiPropertyOptional({ example: "11987654321" })
  phone?: string;

  @ApiPropertyOptional({ type: AddressDto, nullable: true })
  address?: AddressDto | null;
}

export class UpdateUserResponseDto {
  @ApiProperty({ type: GetMeUserResponseDto })
  user!: GetMeUserResponseDto;
}

export class UpdateUserPasswordBodyDto {
  @ApiProperty({
    example: "123456",
    description: "Six-digit confirmation code sent to the user's email.",
    minLength: 6,
    maxLength: 6,
  })
  confirmationCode!: string;

  @ApiProperty({
    example: "new-strong-password",
    description: "New local password.",
    minLength: 8,
    maxLength: 72,
  })
  newPassword!: string;

  @ApiPropertyOptional({
    example: "current-password",
    description:
      "Current local password. Required when the user already has a local password.",
    minLength: 1,
    maxLength: 72,
  })
  currentPassword?: string;
}

export class RequestPasswordChangeConfirmationCodeBodyDto {
  @ApiProperty({
    example: "new-strong-password",
    description: "New local password to confirm via email code.",
    minLength: 8,
    maxLength: 72,
  })
  newPassword!: string;

  @ApiPropertyOptional({
    example: "current-password",
    description:
      "Current local password. Required when the user already has a local password.",
    minLength: 1,
    maxLength: 72,
  })
  currentPassword?: string;
}
