import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { CustomerDocument } from "../../../customer/domain/value-objects/customer-document";

export function normalizeQuoteApprovalPhone(value: string | null | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return Phone.create(value).toString();
  } catch {
    return undefined;
  }
}

export function normalizeQuoteApprovalEmail(value: string | null | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return new Email(value.trim()).toString();
  } catch {
    return undefined;
  }
}

export function normalizeQuoteApprovalDocument(
  value: string | null | undefined,
) {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return CustomerDocument.create(value).toString();
  } catch {
    return undefined;
  }
}

export function normalizeQuoteApprovalPlate(value: string | null | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return CustomerVehicle.normalizePlate(value) ?? undefined;
  } catch {
    return undefined;
  }
}

export function normalizeQuoteApprovalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}
