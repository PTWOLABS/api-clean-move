import { Address } from "../../../accounts/domain/value-objects/address";
import { Email } from "../../../accounts/domain/value-objects/email";
import { Phone } from "../../../accounts/domain/value-objects/phone";
import { Customer } from "../../../customer/domain/entities/customer";
import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import {
  Quote,
  QuoteAddressSnapshot,
} from "../../../quotes/domain/entities/quote";
import { InvalidQuoteInputError } from "../../../quotes/domain/errors/invalid-quote-input-error";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export type QuoteCustomerSnapshotRegistrationInput = {
  email?: string | null;
  phone?: string | null;
};

export function createCustomerFromQuoteSnapshot(input: {
  quote: Quote;
  establishmentId: UniqueEntityId;
  registration?: QuoteCustomerSnapshotRegistrationInput;
}) {
  const phoneValue =
    input.registration?.phone ?? input.quote.customer.phone ?? null;
  const emailValue = input.registration?.email ?? input.quote.customer.email;

  return Customer.create({
    establishmentId: input.establishmentId,
    cpfCnpj: input.quote.customer.cpfCnpj,
    fullName: input.quote.customer.name,
    phone:
      phoneValue !== null && phoneValue.trim()
        ? Phone.create(phoneValue)
        : null,
    email:
      emailValue !== null && emailValue.trim() ? new Email(emailValue) : null,
    address: toCustomerAddress(input.quote.customer.address),
    birthDate: null,
    nickname: null,
  });
}

export function createVehicleFromQuoteSnapshot(input: {
  quote: Quote;
  establishmentId: UniqueEntityId;
  customerId: UniqueEntityId;
}) {
  const snapshot = input.quote.vehicle;

  if (!snapshot) {
    throw new InvalidQuoteInputError(
      "Quote has no vehicle snapshot.",
      "QUOTE_VEHICLE_SNAPSHOT_MISSING",
    );
  }

  if (!snapshot.brand?.trim() || !snapshot.model?.trim()) {
    throw new InvalidQuoteInputError(
      "Quote vehicle snapshot must include brand and model.",
      "QUOTE_VEHICLE_SNAPSHOT_INCOMPLETE",
    );
  }

  return CustomerVehicle.create({
    establishmentId: input.establishmentId,
    customerId: input.customerId,
    imageUrl: null,
    plate: snapshot.plate,
    brand: snapshot.brand,
    model: snapshot.model,
    color: snapshot.color,
    year: snapshot.year,
    notes: null,
  });
}

export function toCustomerAddress(
  address: QuoteAddressSnapshot,
): Address | null {
  if (!address) {
    return null;
  }

  if (
    !address.street ||
    !address.country ||
    !address.state ||
    !address.zipCode ||
    !address.city
  ) {
    throw new InvalidQuoteInputError(
      "Quote customer address is incomplete.",
      "QUOTE_CUSTOMER_ADDRESS_INCOMPLETE",
    );
  }

  return Address.create({
    street: address.street,
    country: address.country,
    state: address.state,
    zipCode: address.zipCode,
    city: address.city,
    complement: address.complement,
  });
}
