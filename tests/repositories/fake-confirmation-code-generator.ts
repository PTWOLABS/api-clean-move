import { ConfirmationCodeGenerator } from "../../src/modules/application/repositories/confirmation-code-generator";

export class FakeConfirmationCodeGenerator implements ConfirmationCodeGenerator {
  constructor(private readonly code = "123456") {}

  generate(): string {
    return this.code;
  }
}
