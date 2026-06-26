import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { ResetTokenGenerator } from "../../modules/application/repositories/reset-token-generator";

@Injectable()
export class SecureResetTokenGenerator implements ResetTokenGenerator {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }
}
