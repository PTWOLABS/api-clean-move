import { ResetTokenGenerator } from "../../src/modules/application/repositories/reset-token-generator";

export class FakeResetTokenGenerator implements ResetTokenGenerator {
  constructor(private readonly token = "reset-token-plain") {}

  generate(): string {
    return this.token;
  }
}
