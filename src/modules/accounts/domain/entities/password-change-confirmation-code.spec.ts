import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { PasswordChangeConfirmationCode } from "./password-change-confirmation-code";

describe("PasswordChangeConfirmationCode", () => {
  it("should report expired codes", () => {
    const code = PasswordChangeConfirmationCode.create({
      userId: new UniqueEntityId(),
      hashedCode: "hashed-code",
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect(code.isExpired(new Date("2020-01-01T00:00:01.000Z"))).toBe(true);
  });

  it("should report active codes", () => {
    const code = PasswordChangeConfirmationCode.create({
      userId: new UniqueEntityId(),
      hashedCode: "hashed-code",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(code.isExpired(new Date("2020-01-01T00:00:00.000Z"))).toBe(false);
  });
});
