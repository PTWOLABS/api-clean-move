import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cpf } from "../../../accounts/domain/value-objects/cpf";
import { InvalidEmployeeFeatureError } from "../policies/employee-features-policy";
import { InvalidRegisterEmployeeInputError } from "../errors/invalid-register-employee-input-error";
import { BirthDate } from "../value-objects/birth-date";
import { Employee } from "./employee";

describe("Employee", () => {
  const referenceDate = new Date("2026-05-04T12:00:00.000Z");

  it("should create an employee with normalized values", () => {
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
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
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
    employee.replaceFeatures(["delete:services"]);

    expect(employee.name).toBe("Beatriz Souza");
    expect(employee.cpf?.toString()).toBe("52998224725");
    expect(employee.birthDate?.equals(birthDate)).toBe(true);
    expect(employee.features).toEqual([
      "read:appointments",
      "read:services",
      "read:customers",
      "delete:services",
    ]);
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
      "create:appointments",
    ]);
  });

  it("should normalize required name and persisted features on restore", () => {
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
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(employee.name).toBe("Ana Silva");
    expect(employee.features).toEqual([
      "read:services",
      "read:appointments",
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
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(InvalidEmployeeFeatureError);
  });
});
