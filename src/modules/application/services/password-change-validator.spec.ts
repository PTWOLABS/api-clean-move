import { Email } from "../../accounts/domain/value-objects/email";
import { makeUser } from "../../../../tests/factories/user-factory";
import { FakeHashComparer } from "../../../../tests/repositories/fake-hash-comparer";
import { InvalidCurrentPasswordError } from "../../../shared/errors/invalid-current-password-error";
import { SamePasswordError } from "../../../shared/errors/same-password-error";
import { InvalidUserPasswordUpdateInputError } from "../use-cases/user/update-user-password";
import { PasswordChangeValidator } from "./password-change-validator";

describe("PasswordChangeValidator", () => {
  let fakeHashComparer: FakeHashComparer;
  let sut: PasswordChangeValidator;

  beforeEach(() => {
    fakeHashComparer = new FakeHashComparer();
    sut = new PasswordChangeValidator(fakeHashComparer);
  });

  it("should allow OAuth-only user to set the first local password", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: null,
    });

    const result = await sut.validate({
      user,
      newPassword: "first-local-password",
    });

    expect(result.isRight()).toBe(true);
  });

  it("should reject OAuth-only user when current password is provided", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: null,
    });

    const result = await sut.validate({
      user,
      newPassword: "first-local-password",
      currentPassword: "should-not-be-sent",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidUserPasswordUpdateInputError);
  });

  it("should reject user with local password when current password is missing", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });

    const result = await sut.validate({
      user,
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidUserPasswordUpdateInputError);
  });

  it("should reject incorrect current password", async () => {
    const user = makeUser("CUSTOMER", {
      hashedPassword: "old-password-hashed",
    });

    const result = await sut.validate({
      user,
      currentPassword: "wrong-password",
      newPassword: "new-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(InvalidCurrentPasswordError);
  });

  it("should reject when new password matches current password", async () => {
    const user = makeUser("CUSTOMER", {
      email: new Email("user@example.com"),
      hashedPassword: "same-password-hashed",
    });

    const result = await sut.validate({
      user,
      currentPassword: "same-password",
      newPassword: "same-password",
    });

    expect(result.isLeft()).toBe(true);
    expect(result.value).toBeInstanceOf(SamePasswordError);
  });
});
