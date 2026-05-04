import { ValueObject } from "../../../../shared/entities/value-object";

type BirthDateProps = {
  value: Date;
};

export type BirthDateCreateOptions = {
  mustBeAdult?: boolean;
  referenceDate?: Date;
};

export class InvalidBirthDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBirthDateError";
  }
}

export class BirthDate extends ValueObject<BirthDateProps> {
  private constructor(props: BirthDateProps) {
    super(props);
  }

  get value() {
    return new Date(this.props.value);
  }

  static create(value: Date, options: BirthDateCreateOptions = {}) {
    if (Number.isNaN(value.getTime())) {
      throw new InvalidBirthDateError("Invalid birth date.");
    }

    const mustBeAdult = options.mustBeAdult ?? true;
    const referenceDate = BirthDate.startOfDay(
      options.referenceDate ?? new Date(),
    );
    const birthDate = BirthDate.startOfDay(value);
    const minimumDate = new Date(Date.UTC(1900, 0, 1));

    if (birthDate < minimumDate) {
      throw new InvalidBirthDateError(
        "Birth date cannot be before 1900-01-01.",
      );
    }

    if (birthDate > referenceDate) {
      throw new InvalidBirthDateError("Birth date cannot be in the future.");
    }

    if (mustBeAdult && !BirthDate.isAdultAt(birthDate, referenceDate)) {
      throw new InvalidBirthDateError("Employee must be at least 18 years old.");
    }

    return new BirthDate({ value: birthDate });
  }

  toDate() {
    return new Date(this.props.value);
  }

  toString() {
    return this.props.value.toISOString();
  }

  equals(other: BirthDate) {
    return other.toString() === this.toString();
  }

  private static startOfDay(value: Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private static isAdultAt(birthDate: Date, referenceDate: Date) {
    const adultDate = new Date(birthDate);
    adultDate.setUTCFullYear(adultDate.getUTCFullYear() + 18);

    return adultDate <= referenceDate;
  }
}
