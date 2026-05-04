import { BirthDate, InvalidBirthDateError } from "./birth-date";

describe("BirthDate", () => {
  const referenceDate = new Date("2026-05-04T12:00:00.000Z");

  it("should create a valid adult birth date", () => {
    const birthDate = BirthDate.create(
      new Date("1995-01-01T00:00:00.000Z"),
      { referenceDate },
    );

    expect(birthDate.value).toEqual(new Date("1995-01-01T00:00:00.000Z"));
    expect(birthDate.toDate()).toEqual(
      new Date("1995-01-01T00:00:00.000Z"),
    );
    expect(birthDate.toString()).toBe("1995-01-01T00:00:00.000Z");
  });

  it("should reject a birth date before 1900", () => {
    expect(() =>
      BirthDate.create(new Date("1899-12-31T00:00:00.000Z"), {
        referenceDate,
      }),
    ).toThrow(InvalidBirthDateError);
  });

  it("should reject a future birth date", () => {
    expect(() =>
      BirthDate.create(new Date("2026-05-05T00:00:00.000Z"), {
        referenceDate,
      }),
    ).toThrow(InvalidBirthDateError);
  });

  it("should reject a minor by default", () => {
    expect(() =>
      BirthDate.create(new Date("2010-05-04T00:00:00.000Z"), {
        referenceDate,
      }),
    ).toThrow(InvalidBirthDateError);
  });

  it("should allow a minor when mustBeAdult is false", () => {
    const birthDate = BirthDate.create(
      new Date("2010-05-04T00:00:00.000Z"),
      {
        mustBeAdult: false,
        referenceDate,
      },
    );

    expect(birthDate.toString()).toBe("2010-05-04T00:00:00.000Z");
  });

  it("should compare birth dates by value", () => {
    const first = BirthDate.create(new Date("1995-01-01T00:00:00.000Z"), {
      referenceDate,
    });
    const second = BirthDate.create(new Date("1995-01-01T15:30:00.000Z"), {
      referenceDate,
    });

    expect(first.equals(second)).toBe(true);
  });
});
