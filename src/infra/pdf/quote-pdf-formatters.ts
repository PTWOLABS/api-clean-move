import {
  QuoteAddressSnapshot,
  QuoteDiscountType,
  QuotePaymentMethod,
} from "../../modules/quotes/domain/entities/quote";

const BRAZIL_TIMEZONE = "America/Sao_Paulo";

export function formatCurrency(amountInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);
}

export function formatQuoteDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: BRAZIL_TIMEZONE,
  }).format(date);
}

export function formatDocument(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
    );
  }

  return value;
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }

  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }

  return value;
}

export function formatAddress(address: QuoteAddressSnapshot) {
  if (!address) return null;

  const street = [address.street, address.complement]
    .filter(isPresent)
    .join(", ");
  const cityState = [address.city, address.state].filter(isPresent).join(" - ");
  const zipCode = address.zipCode
    ? `CEP ${formatZipCode(address.zipCode)}`
    : null;

  const formatted = [street, cityState, zipCode, address.country]
    .filter(isPresent)
    .join(" • ");

  return formatted || null;
}

export function formatDuration(durationInMinutes: number) {
  const hours = Math.floor(durationInMinutes / 60);
  const minutes = durationInMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}min`;
}

export function formatPaymentMethod(method: QuotePaymentMethod) {
  const labels: Record<QuotePaymentMethod, string> = {
    CASH: "Dinheiro",
    PIX: "Pix",
    CARD: "Cartão",
    OTHER: "Outro",
  };

  return labels[method];
}

export function formatDiscount(type: QuoteDiscountType, value: number): string {
  if (type === "PERCENTAGE") {
    return `${value}% de desconto`;
  }

  return `${formatCurrency(value)} de desconto`;
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 8) {
    return digits.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  }

  return value;
}

function isPresent(value: string | null): value is string {
  return Boolean(value?.trim());
}
