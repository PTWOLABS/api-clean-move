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
