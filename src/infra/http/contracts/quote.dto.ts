import {
  QuoteDiscountType,
  QuotePaymentMethod,
} from "../../../modules/quotes/domain/entities/quote";

export type QuoteAddressDTO = {
  street: string | null;
  country: string | null;
  state: string | null;
  zipCode: string | null;
  city: string | null;
  complement: string | null;
};

export type QuoteServiceCategoryDTO = {
  id: string;
  name: string;
};

export type QuoteItemDTO = {
  id: string;
  establishmentId: string;
  customerId: string | null;
  vehicleId: string | null;
  convertedAppointmentId: string | null;
  convertedAt: string | null;
  establishment: {
    name: string;
    legalBusinessName: string;
    cnpj: string;
    address: QuoteAddressDTO | null;
    bannerImageUrl: string | null;
  };
  customer: {
    name: string;
    phone: string | null;
    cpfCnpj: string | null;
    address: QuoteAddressDTO | null;
  };
  vehicle: {
    plate: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    year: number | null;
  } | null;
  services: {
    id: string;
    name: string;
    category: QuoteServiceCategoryDTO | null;
    durationInMinutes: number | null;
    priceInCents: number;
    isCourtesy: boolean;
  }[];
  paymentOptions: {
    method: QuotePaymentMethod;
    label: string;
    installments: number;
    interestFree: boolean;
    discountType: QuoteDiscountType | null;
    discountValue: number | null;
    totalInCents: number;
  }[];
  subtotalInCents: number;
  totalCourtesyValueInCents: number;
  description: string | null;
  termsAndConditions: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteSingleResponseDTO = { quote: QuoteItemDTO };

export type QuoteCustomerKind = "CUSTOMER" | "PROSPECT";

export type QuoteStatus = "VALID" | "EXPIRES_TODAY" | "EXPIRED" | "APPROVED";

export type QuoteListItemDTO = {
  id: string;
  code?: string;
  customerName: string;
  customerKind: QuoteCustomerKind;
  vehicleLabel: string | null;
  vehiclePlate: string | null;
  totalInCents: number;
  status: QuoteStatus;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  servicesCount?: number;
};

export type QuoteSummaryDTO = {
  valid: number;
  expiresToday: number;
  approved: number;
  expired: number;
};

export type QuoteListDTO = {
  quotes: QuoteListItemDTO[];
  totalItems: number;
  summary: QuoteSummaryDTO;
};
