import { ValueObject } from "../../../../shared/entities/value-object";

export type CategoryNameProps = {
  value: string;
};

export class InvalidCategoryNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCategoryNameError";
  }
}

export class CategoryName extends ValueObject<CategoryNameProps> {
  private constructor(props: CategoryNameProps) {
    super(props);
  }

  static create(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidCategoryNameError("Category name cannot be empty");
    }

    if (normalizedValue.length > 48) {
      throw new InvalidCategoryNameError(
        "Category name should be shorter: max 48 characters.",
      );
    }

    return new CategoryName({ value: normalizedValue });
  }

  get value() {
    return this.props.value;
  }

  toString() {
    return this.props.value;
  }
}
