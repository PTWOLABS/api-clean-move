import { ProfileAlreadyCompleteError } from "../errors/profile-already-complete-error";
import { UserPasswordChangedEvent } from "../events/user-password-changed-event";
import { UserRegisteredEvent } from "../events/user-registered-event";
import { Address } from "../value-objects/address";
import { Email } from "../value-objects/email";
import { Phone } from "../value-objects/phone";
import { User } from "./user";

describe("User", () => {
  it("should not touch updatedAt when changing email to the same value", () => {
    const updatedAt = new Date("2026-04-01T08:00:00");
    const user = User.create({
      name: "John Doe",
      email: new Email("john@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      phone: Phone.create("11987654321"),
      address: Address.create({
        city: "Sao Paulo",
        country: "BR",
        state: "SP",
        street: "Rua A",
        zipCode: "01310-100",
      }),
      createdAt: new Date("2026-04-01T07:00:00"),
      updatedAt,
    });

    user.changeEmail(new Email("john@example.com"));

    expect(user.updatedAt).toBe(updatedAt);
  });

  it("should not touch updatedAt when changing phone to the same value", () => {
    const updatedAt = new Date("2026-04-01T08:00:00");
    const user = User.create({
      name: "John Doe",
      email: new Email("john@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      phone: Phone.create("11987654321"),
      address: Address.create({
        city: "Sao Paulo",
        country: "BR",
        state: "SP",
        street: "Rua A",
        zipCode: "01310-100",
      }),
      createdAt: new Date("2026-04-01T07:00:00"),
      updatedAt,
    });

    user.changePhone(Phone.create("(11) 98765-4321"));

    expect(user.updatedAt).toBe(updatedAt);
  });

  it("should not allow completing an already complete profile", () => {
    const user = User.create({
      name: "John Doe",
      email: new Email("john@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      phone: Phone.create("11987654321"),
      address: Address.create({
        city: "Sao Paulo",
        country: "BR",
        state: "SP",
        street: "Rua A",
        zipCode: "01310-100",
      }),
    });

    expect(() =>
      user.completeProfile({
        phone: Phone.create("11911112222"),
        address: Address.create({
          city: "Campinas",
          country: "BR",
          state: "SP",
          street: "Rua B",
          zipCode: "13010-100",
        }),
      }),
    ).toThrow(ProfileAlreadyCompleteError);
  });

  it("should normalize profileImageUrl on create and update", () => {
    const user = User.create({
      name: "John Doe",
      email: new Email("john@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      phone: null,
      address: null,
      profileImageUrl: " https://cdn.example/avatar.png ",
    });

    expect(user.profileImageUrl).toBe("https://cdn.example/avatar.png");

    user.update({ profileImageUrl: "   " });
    expect(user.profileImageUrl).toBeNull();
  });

  it("should emit UserRegisteredEvent when user is registered", () => {
    const user = User.register({
      name: "John Doe",
      email: new Email("john@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      phone: null,
      address: null,
    });

    expect(user.domainEvents).toHaveLength(1);
    expect(user.domainEvents[0]).toBeInstanceOf(UserRegisteredEvent);
    expect(user.domainEvents[0]?.getAggregateId().equals(user.id)).toBe(true);
  });

  it("should not emit UserRegisteredEvent when user is created or restored", () => {
    const createdUser = User.create({
      name: "John Doe",
      email: new Email("john@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      phone: null,
      address: null,
    });

    const restoredUser = User.restore({
      name: "Jane Doe",
      email: new Email("jane@example.com"),
      hashedPassword: "hashed-password",
      role: "CUSTOMER",
      profileImageUrl: null,
      phone: null,
      address: null,
      socialAccounts: [],
      createdAt: new Date("2026-04-01T07:00:00"),
      updatedAt: new Date("2026-04-01T08:00:00"),
    });

    expect(createdUser.domainEvents).toHaveLength(0);
    expect(restoredUser.domainEvents).toHaveLength(0);
  });

  it("should emit UserPasswordChangedEvent when password changes", () => {
    const user = User.create({
      name: "John Doe",
      email: new Email("john@example.com"),
      hashedPassword: "old-hashed",
      role: "CUSTOMER",
      phone: null,
      address: null,
    });

    user.pullDomainEvents();
    user.changePassword("new-hashed");

    expect(user.domainEvents).toHaveLength(1);
    expect(user.domainEvents[0]).toBeInstanceOf(UserPasswordChangedEvent);
    expect(user.domainEvents[0]?.getAggregateId().equals(user.id)).toBe(true);
  });
});
