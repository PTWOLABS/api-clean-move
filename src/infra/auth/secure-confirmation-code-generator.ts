import { randomInt } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { ConfirmationCodeGenerator } from "../../modules/application/repositories/confirmation-code-generator";

@Injectable()
export class SecureConfirmationCodeGenerator implements ConfirmationCodeGenerator {
  generate(): string {
    return randomInt(100_000, 1_000_000).toString();
  }
}
