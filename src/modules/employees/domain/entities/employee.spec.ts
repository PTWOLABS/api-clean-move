import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cpf } from "../../../accounts/domain/value-objects/cpf";
import { EmployeeAlreadyDeletedError } from "../errors/employee-already-deleted-error";
import { InvalidRegisterEmployeeInputError } from "../errors/invalid-register-employee-input-error";
import { InvalidEmployeeFeatureError } from "../policies/employee-features-policy";
import { BirthDate } from "../value-objects/birth-date";
import { Employee } from "./employee";

describe("Employee", () => {
  const referenceDate = new Date("2026-05-05T12:00:00.000Z");

  it("should create an active employee with normalized values", () => {
    const establishmentId = new UniqueEntityId();
    const userId = new UniqueEntityId();
    const birthDate = BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
      referenceDate,
    });

    const employee = Employee.create({
      establishmentId,
      userId,
      name: " Ana Silva ",
      cpf: "529.982.247-25",
      birthDate,
      extraFeatures: ["update:customers", "create:appointments"],
    });

    expect(employee.establishmentId).toBe(establishmentId);
    expect(employee.userId).toBe(userId);
    expect(employee.name).toBe("Ana Silva");
    expect(employee.cpf?.toString()).toBe("52998224725");
    expect(employee.birthDate?.equals(birthDate)).toBe(true);
    expect(employee.profileImageUrl).toBeNull();
    expect(employee.deletedAt).toBeNull();
    expect(employee.isDeleted()).toBe(false);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
      "update:customers",
    ]);
  });

  it("should create an employee with nullable optional values", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });

    expect(employee.cpf).toBeNull();
    expect(employee.birthDate).toBeNull();
    expect(employee.profileImageUrl).toBeNull();
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
    ]);
  });

  it("should normalize profileImageUrl on create", () => {
    const baseProps = {
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    };

    const omitted = Employee.create(baseProps);
    const withNull = Employee.create({ ...baseProps, profileImageUrl: null });
    const withBlank = Employee.create({
      ...baseProps,
      profileImageUrl: "   ",
    });
    const withTrim = Employee.create({
      ...baseProps,
      profileImageUrl: " https://cdn.example/avatar.png ",
    });

    expect(omitted.profileImageUrl).toBeNull();
    expect(withNull.profileImageUrl).toBeNull();
    expect(withBlank.profileImageUrl).toBeNull();
    expect(withTrim.profileImageUrl).toBe("https://cdn.example/avatar.png");
  });

  it("should reject an empty employee name", () => {
    expect(() =>
      Employee.create({
        establishmentId: new UniqueEntityId(),
        userId: new UniqueEntityId(),
        name: "   ",
      }),
    ).toThrow(InvalidRegisterEmployeeInputError);
  });

  it("should update coherent employee fields", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });
    const birthDate = BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
      referenceDate,
    });

    employee.changeName(" Beatriz Souza ");
    employee.changeCpf(Cpf.create("52998224725"));
    employee.changeBirthDate(birthDate);
    employee.replaceFeatures(["delete:services", "update:employees:self"]);

    expect(employee.name).toBe("Beatriz Souza");
    expect(employee.cpf?.toString()).toBe("52998224725");
    expect(employee.birthDate?.equals(birthDate)).toBe(true);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "delete:services",
      "update:employees:self",
    ]);
  });

  it("should update through the aggregate update method", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
      extraFeatures: ["create:appointments"],
    });

    employee.update({
      name: " Beatriz Souza ",
      birthDate: new Date("1995-01-01T00:00:00.000Z"),
      extraFeatures: ["update:employees:self"],
    });

    expect(employee.name).toBe("Beatriz Souza");
    expect(employee.birthDate?.toString()).toBe("1995-01-01T00:00:00.000Z");
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "update:employees:self",
    ]);
  });

  it("should keep update atomic when later validation fails", () => {
    const originalFeatures = [
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
    ];

    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });

    expect(employee.features).toEqual(originalFeatures);

    expect(() =>
      employee.update({
        name: "Beatriz Souza",
        extraFeatures: ["invalid:feature"],
      }),
    ).toThrow(InvalidEmployeeFeatureError);

    expect(employee.name).toBe("Ana Silva");
    expect(employee.features).toEqual(originalFeatures);
  });

  it("should set profile image URL", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });

    employee.setProfileImageUrl("  https://cdn.example.com/a.png  ");

    expect(employee.profileImageUrl).toBe("https://cdn.example.com/a.png");
  });

  it("should soft-delete an employee and remove only session features", () => {
    const deletedAt = new Date("2026-05-05T10:00:00.000Z");
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
      extraFeatures: ["create:appointments", "update:employees:self"],
    });

    employee.softDelete(deletedAt);

    expect(employee.deletedAt).toEqual(deletedAt);
    expect(employee.updatedAt).toEqual(deletedAt);
    expect(employee.isDeleted()).toBe(true);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:appointments",
      "update:employees:self",
    ]);
  });

  it("should reject updates after soft delete", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
    });

    employee.softDelete(new Date("2026-05-05T10:00:00.000Z"));

    expect(() => employee.update({ name: "Beatriz Souza" })).toThrow(
      EmployeeAlreadyDeletedError,
    );
    expect(() => employee.changeName("Beatriz Souza")).toThrow(
      EmployeeAlreadyDeletedError,
    );
    expect(() => employee.changeCpf(Cpf.create("52998224725"))).toThrow(
      EmployeeAlreadyDeletedError,
    );
    expect(() =>
      employee.changeBirthDate(
        BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
          referenceDate,
        }),
      ),
    ).toThrow(EmployeeAlreadyDeletedError);
    expect(() => employee.replaceFeatures(["update:employees:self"])).toThrow(
      EmployeeAlreadyDeletedError,
    );
    expect(() =>
      employee.setProfileImageUrl("https://cdn.example.com/a.png"),
    ).toThrow(EmployeeAlreadyDeletedError);
    expect(() => employee.softDelete()).toThrow(EmployeeAlreadyDeletedError);
  });

  it("should return a defensive copy for features getter", () => {
    const employee = Employee.create({
      establishmentId: new UniqueEntityId(),
      userId: new UniqueEntityId(),
      name: "Ana Silva",
      extraFeatures: ["create:appointments"],
    });

    const features = employee.features;
    features.push("update:customers");

    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "read:employees:self",
      "create:sessions:self",
      "read:sessions:self",
      "create:appointments",
    ]);
  });

  it("should normalize required name, features, and deletedAt on restore", () => {
    const establishmentId = new UniqueEntityId();
    const userId = new UniqueEntityId();

    const employee = Employee.restore({
      establishmentId,
      userId,
      profileImageUrl: null,
      name: " Ana Silva ",
      cpf: null,
      birthDate: null,
      features: ["read:services", "read:appointments", "read:customers"],
      deletedAt: new Date("2026-05-05T10:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(employee.name).toBe("Ana Silva");
    expect(employee.deletedAt).toEqual(new Date("2026-05-05T10:00:00.000Z"));
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
    ]);
  });

  it("should reject invalid persisted features on restore", () => {
    expect(() =>
      Employee.restore({
        establishmentId: new UniqueEntityId(),
        userId: new UniqueEntityId(),
        profileImageUrl: null,
        name: "Ana Silva",
        cpf: null,
        birthDate: null,
        features: ["invalid:feature"] as unknown as Employee["features"],
        deletedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(InvalidEmployeeFeatureError);
  });
});
