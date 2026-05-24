import { ValueObject } from "../../../../shared/entities/value-object";
import { InvalidQuoteInputError } from "../errors/invalid-quote-input-error";

export type QuotePaymentMethod = "CASH" | "PIX" | "CARD" | "OTHER";

export type QuoteDiscountType = "PERCENTAGE" | "AMOUNT";

export type QuotePaymentOptionInput = {
  method: QuotePaymentMethod;
  label: string;
  installments?: number | null;
  interestFree?: boolean | null;
  discountType?: QuoteDiscountType | null;
  discountValue?: number | null;
};

export type QuotePaymentOptionProps = {
  method: QuotePaymentMethod;
  label: string;
  installments: number;
  interestFree: boolean;
  discountType: QuoteDiscountType | null;
  discountValue: number | null;
  totalInCents: number;
};

export class QuotePaymentOption extends ValueObject<QuotePaymentOptionProps> {
  private constructor(props: QuotePaymentOptionProps) {
    super(props);
  }

  get method() {
    return this.props.method;
  }

  get label() {
    return this.props.label;
  }

  get installments() {
    return this.props.installments;
  }

  get interestFree() {
    return this.props.interestFree;
  }

  get discountType() {
    return this.props.discountType;
  }

  get discountValue() {
    return this.props.discountValue;
  }

  get totalInCents() {
    return this.props.totalInCents;
  }

  static create(
    input: QuotePaymentOptionInput,
    subtotalInCents: number,
  ): QuotePaymentOption {
    const method = input.method;
    const label = this.normalizeRequiredText(input.label);
    const installments = input.installments ?? 1;
    const discountType = input.discountType ?? null;
    const discountValue = input.discountValue ?? null;

    this.assertValid({
      method,
      interestFree: input.interestFree,
      discountType,
      discountValue,
      installments,
      subtotalInCents,
    });

    return new QuotePaymentOption({
      method,
      label,
      installments,
      interestFree: input.interestFree ?? true,
      discountType,
      discountValue,
      totalInCents: this.calculateTotalInCents({
        discountType,
        discountValue,
        subtotalInCents,
      }),
    });
  }

  toValue(): QuotePaymentOptionProps {
    return { ...this.props };
  }

  private static assertValid(input: {
    method: QuotePaymentMethod;
    interestFree: boolean | null | undefined;
    discountType: QuoteDiscountType | null;
    discountValue: number | null;
    installments: number;
    subtotalInCents: number;
  }) {
    if (!this.isPaymentMethod(input.method)) {
      throw new InvalidQuoteInputError("Invalid payment method.");
    }

    if (
      input.discountType !== null &&
      !this.isDiscountType(input.discountType)
    ) {
      throw new InvalidQuoteInputError("Invalid discount type.");
    }

    if (
      input.interestFree !== null &&
      input.interestFree !== undefined &&
      typeof input.interestFree !== "boolean"
    ) {
      throw new InvalidQuoteInputError("interestFree must be a boolean.");
    }

    if (!Number.isInteger(input.installments) || input.installments < 1) {
      throw new InvalidQuoteInputError(
        "Installments must be an integer greater than or equal to one.",
      );
    }

    if (input.discountType === null && input.discountValue !== null) {
      throw new InvalidQuoteInputError(
        "Discount value must be null when discount type is null.",
      );
    }

    if (input.discountType !== null && input.discountValue === null) {
      throw new InvalidQuoteInputError(
        "Discount value is required when discount type is provided.",
      );
    }

    if (input.discountValue === null) {
      return;
    }

    if (!Number.isInteger(input.discountValue)) {
      throw new InvalidQuoteInputError("Discount value must be an integer.");
    }

    if (
      input.discountType === "PERCENTAGE" &&
      (input.discountValue < 0 || input.discountValue > 100)
    ) {
      throw new InvalidQuoteInputError(
        "Percentage discount must be between 0 and 100.",
      );
    }

    if (
      input.discountType === "AMOUNT" &&
      (input.discountValue < 0 || input.discountValue > input.subtotalInCents)
    ) {
      throw new InvalidQuoteInputError(
        "Amount discount must be between 0 and the quote subtotal.",
      );
    }
  }

  private static calculateTotalInCents(input: {
    discountType: QuoteDiscountType | null;
    discountValue: number | null;
    subtotalInCents: number;
  }) {
    if (input.discountType === "PERCENTAGE" && input.discountValue !== null) {
      return Math.round(
        input.subtotalInCents * ((100 - input.discountValue) / 100),
      );
    }

    if (input.discountType === "AMOUNT" && input.discountValue !== null) {
      return input.subtotalInCents - input.discountValue;
    }

    return input.subtotalInCents;
  }

  private static isPaymentMethod(
    method: QuotePaymentMethod,
  ): method is QuotePaymentMethod {
    return ["CASH", "PIX", "CARD", "OTHER"].includes(method);
  }

  private static isDiscountType(
    discountType: QuoteDiscountType,
  ): discountType is QuoteDiscountType {
    return ["PERCENTAGE", "AMOUNT"].includes(discountType);
  }

  private static normalizeRequiredText(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new InvalidQuoteInputError("payment option label is required.");
    }

    return normalizedValue;
  }
}
