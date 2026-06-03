import { ApiProperty } from "@nestjs/swagger";

export class AuthSuccessResponseDto {
  @ApiProperty({
    example: "9f7f5e87-1f82-4d7d-8c3c-90c4f6073d11",
    description: "Authenticated user identifier.",
  })
  userId!: string;

  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT access token for protected routes.",
  })
  accessToken!: string;
}

export class LoginWithCredentialsBodyDto {
  @ApiProperty({
    example: "user@example.com",
    description: "User email.",
  })
  email!: string;

  @ApiProperty({
    example: "123456",
    description: "User password.",
  })
  password!: string;
}

export class AuthenticateWithGoogleBodyDto {
  @ApiProperty({
    example: "google-id-token",
    description: "Google ID token returned by the frontend OAuth flow.",
  })
  idToken!: string;

  @ApiProperty({
    enum: ["CUSTOMER", "ESTABLISHMENT"],
    example: "ESTABLISHMENT",
    description: "Role assigned when creating a new user via OAuth.",
  })
  role!: string;
}
