import { Module } from "@nestjs/common";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { APP_GUARD } from "@nestjs/core";
import { HashGenerator } from "../../modules/application/repositories/hash-generator";
import { HashComparer } from "../../modules/application/repositories/hash-comparer";
import { OAuthIdTokenVerifier } from "../../modules/application/services/oauth-id-token-verifier";
import { EmployeeSessionAccessService } from "../../modules/application/services/employee-session-access";
import { GoogleIdTokenVerifier } from "./google-id-token-verifier";
import { TokenHasher } from "../../modules/application/repositories/token-hasher";
import { EnvModule } from "../env/env.module";
import { EnvService } from "../env/env.service";
import { AccessSessionGuard } from "./access-session.guard";
import { BcryptHasher } from "./bcrypt-hasher";
import { AuthService } from "./auth.service";
import { RefreshTokenCookieService } from "./refresh-token-cookie.service";
import { RolesGuard } from "./roles.guard";
import { Sha256TokenHasher } from "./sha256-token-hasher";
import { EmployeeFeaturesGuard } from "./employee-features.guard";

@Module({
  imports: [
    EnvModule,
    JwtModule.registerAsync({
      inject: [EnvService],
      useFactory: (envService: EnvService): JwtModuleOptions => ({
        secret: envService.get("JWT_ACCESS_SECRET"),
        signOptions: {
          algorithm: "HS256",
          expiresIn: envService.get("JWT_ACCESS_EXPIRES_IN"),
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    RefreshTokenCookieService,
    {
      provide: APP_GUARD,
      useClass: AccessSessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EmployeeFeaturesGuard,
    },
    BcryptHasher,
    Sha256TokenHasher,
    EmployeeSessionAccessService,
    { provide: HashGenerator, useExisting: BcryptHasher },
    { provide: HashComparer, useExisting: BcryptHasher },
    { provide: OAuthIdTokenVerifier, useClass: GoogleIdTokenVerifier },
    { provide: TokenHasher, useExisting: Sha256TokenHasher },
  ],
  exports: [
    AuthService,
    HashGenerator,
    HashComparer,
    OAuthIdTokenVerifier,
    RefreshTokenCookieService,
    TokenHasher,
    EmployeeSessionAccessService,
  ],
})
export class AuthModule {}
