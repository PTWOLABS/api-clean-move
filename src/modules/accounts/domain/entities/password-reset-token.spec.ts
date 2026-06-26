import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { PasswordResetToken } from "./password-reset-token";

describe("PasswordResetToken", () => {
  it("isExpired returns false before expiresAt", () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const token = PasswordResetToken.create({
      userId: new UniqueEntityId(),
      hashedToken: "x",
      expiresAt,
    });

    expect(token.isExpired(new Date("2029-12-31T23:59:59.999Z"))).toBe(false);
  });

  it("isExpired returns true at or after expiresAt", () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const token = PasswordResetToken.create({
      userId: new UniqueEntityId(),
      hashedToken: "x",
      expiresAt,
    });

    expect(token.isExpired(expiresAt)).toBe(true);
    expect(token.isExpired(new Date("2030-01-01T00:00:00.001Z"))).toBe(true);
  });
});
