import { randomBytes } from "node:crypto";

import { ResetTokenGenerator } from "./reset-token-generator";

export class SecureResetTokenGenerator implements ResetTokenGenerator {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }
}
