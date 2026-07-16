import {
  Prisma,
  Quote as PrismaQuoteRecord,
  QuotePaymentOption as PrismaQuotePaymentOptionRecord,
  QuoteService as PrismaQuoteServiceRecord,
} from "../../../../generated/prisma/client";
import {
  Quote,
  QuoteAddressSnapshot,
} from "../../../../modules/quotes/domain/entities/quote";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import z from "zod";

function toCategorySnapshot(
  categoryId: string | null,
  categoryName: string | null,
) {
  if (!categoryId || !categoryName) {
    return undefined;
  }

  return {
    id: new UniqueEntityId(categoryId),
    name: categoryName,
  };
}

export type PrismaQuoteWithRelations = PrismaQuoteRecord & {
  services: PrismaQuoteServiceRecord[];
  paymentOptions: PrismaQuotePaymentOptionRecord[];
};

export const addressJsonSchema = z.object({
  street: z.string().nullable(),
  country: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  complement: z.string().nullable().optional(),
});

export function toAddressSnapshot(
  raw: Prisma.JsonValue | null,
): QuoteAddressSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const value = addressJsonSchema.parse(raw);

  return {
    street: value.street,
    country: value.country,
    state: value.state,
    zipCode: value.zipCode,
    city: value.city,
    complement: value.complement ?? null,
  };
}

export function toPrismaAddress(
  address: QuoteAddressSnapshot,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!address) {
    return Prisma.JsonNull;
  }

  return {
    street: address.street,
    country: address.country,
    state: address.state,
    zipCode: address.zipCode,
    city: address.city,
    complement: address.complement,
  };
}

export function hasVehicleSnapshot(raw: PrismaQuoteRecord): boolean {
  return [
    raw.vehicleId,
    raw.vehiclePlate,
    raw.vehicleBrand,
    raw.vehicleModel,
    raw.vehicleColor,
    raw.vehicleYear,
  ].some((value) => value !== null);
}

export function toQuoteServicesCreate(
  raw: Quote,
): Prisma.QuoteServiceUncheckedCreateWithoutQuoteInput[] {
  return raw.services.map((service, index) => ({
    id: service.quoteServiceId.toString(),
    serviceId: service.serviceId?.toString() ?? null,
    serviceName: service.serviceName,
    serviceCategoryId: service.category?.id.toString() ?? null,
    serviceCategoryName: service.category?.name ?? null,
    serviceDurationInMinutes: service.durationInMinutes ?? null,
    servicePriceInCents: service.priceInCents,
    isCourtesy: service.isCourtesy,
    position: index,
  }));
}

export function toPaymentOptionsCreate(
  raw: Quote,
): Prisma.QuotePaymentOptionUncheckedCreateWithoutQuoteInput[] {
  return raw.paymentOptions.map((paymentOption, index) => ({
    method: paymentOption.method,
    label: paymentOption.label,
    installments: paymentOption.installments,
    interestFree: paymentOption.interestFree,
    discountType: paymentOption.discountType,
    discountValue: paymentOption.discountValue,
    totalInCents: paymentOption.totalInCents,
    position: index,
  }));
}

export class PrismaQuoteMapper {
  static toDomain(raw: PrismaQuoteWithRelations): Quote {
    return Quote.create(
      {
        establishmentId: new UniqueEntityId(raw.establishmentId),
        customerId: raw.customerId ? new UniqueEntityId(raw.customerId) : null,
        vehicleId: raw.vehicleId ? new UniqueEntityId(raw.vehicleId) : null,
        convertedAppointmentId: raw.convertedAppointmentId
          ? new UniqueEntityId(raw.convertedAppointmentId)
          : null,
        convertedAt: raw.convertedAt,
        establishment: {
          name: raw.establishmentName,
          legalBusinessName: raw.establishmentLegalBusinessName,
          cnpj: raw.establishmentCnpj,
          address: toAddressSnapshot(raw.establishmentAddress),
          bannerImageUrl: raw.establishmentBannerImageUrl,
        },
        customer: {
          name: raw.customerName,
          phone: raw.customerPhone,
          email: raw.customerEmail,
          cpfCnpj: raw.customerCpfCnpj,
          address: toAddressSnapshot(raw.customerAddress),
        },
        vehicle: hasVehicleSnapshot(raw)
          ? {
              plate: raw.vehiclePlate,
              brand: raw.vehicleBrand,
              model: raw.vehicleModel,
              color: raw.vehicleColor,
              year: raw.vehicleYear,
            }
          : null,
        services: raw.services
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((service) => ({
            quoteServiceId: new UniqueEntityId(service.id),
            serviceId: service.serviceId
              ? new UniqueEntityId(service.serviceId)
              : null,
            serviceName: service.serviceName,
            category: toCategorySnapshot(
              service.serviceCategoryId,
              service.serviceCategoryName,
            ),
            durationInMinutes: service.serviceDurationInMinutes ?? undefined,
            priceInCents: service.servicePriceInCents,
            isCourtesy: service.isCourtesy,
          })),
        paymentOptions: raw.paymentOptions
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((paymentOption) => ({
            method: paymentOption.method,
            label: paymentOption.label,
            installments: paymentOption.installments,
            interestFree: paymentOption.interestFree,
            discountType: paymentOption.discountType,
            discountValue: paymentOption.discountValue,
          })),
        description: raw.description,
        termsAndConditions: raw.termsAndConditions,
        expiresAt: raw.expiresAt,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityId(raw.id),
    );
  }

  static toPrisma(raw: Quote): Prisma.QuoteUncheckedCreateInput {
    const establishment = raw.establishment;
    const customer = raw.customer;
    const vehicle = raw.vehicle;

    return {
      id: raw.id.toString(),
      establishmentId: raw.establishmentId.toString(),
      customerId: raw.customerId?.toString() ?? null,
      vehicleId: raw.vehicleId?.toString() ?? null,
      convertedAppointmentId: raw.convertedAppointmentId?.toString() ?? null,
      convertedAt: raw.convertedAt,
      establishmentName: establishment.name,
      establishmentLegalBusinessName: establishment.legalBusinessName,
      establishmentCnpj: establishment.cnpj,
      establishmentAddress: toPrismaAddress(establishment.address),
      establishmentBannerImageUrl: establishment.bannerImageUrl,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerCpfCnpj: customer.cpfCnpj,
      customerAddress: toPrismaAddress(customer.address),
      vehiclePlate: vehicle?.plate ?? null,
      vehicleBrand: vehicle?.brand ?? null,
      vehicleModel: vehicle?.model ?? null,
      vehicleColor: vehicle?.color ?? null,
      vehicleYear: vehicle?.year ?? null,
      description: raw.description,
      termsAndConditions: raw.termsAndConditions,
      expiresAt: raw.expiresAt,
      services: {
        create: toQuoteServicesCreate(raw),
      },
      paymentOptions: {
        create: toPaymentOptionsCreate(raw),
      },
      ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  static toPrismaUpdate(raw: Quote): Prisma.QuoteUncheckedUpdateInput {
    const establishment = raw.establishment;
    const customer = raw.customer;
    const vehicle = raw.vehicle;

    return {
      customerId: raw.customerId?.toString() ?? null,
      vehicleId: raw.vehicleId?.toString() ?? null,
      convertedAppointmentId: raw.convertedAppointmentId?.toString() ?? null,
      convertedAt: raw.convertedAt,
      establishmentName: establishment.name,
      establishmentLegalBusinessName: establishment.legalBusinessName,
      establishmentCnpj: establishment.cnpj,
      establishmentAddress: toPrismaAddress(establishment.address),
      establishmentBannerImageUrl: establishment.bannerImageUrl,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerCpfCnpj: customer.cpfCnpj,
      customerAddress: toPrismaAddress(customer.address),
      vehiclePlate: vehicle?.plate ?? null,
      vehicleBrand: vehicle?.brand ?? null,
      vehicleModel: vehicle?.model ?? null,
      vehicleColor: vehicle?.color ?? null,
      vehicleYear: vehicle?.year ?? null,
      description: raw.description,
      termsAndConditions: raw.termsAndConditions,
      expiresAt: raw.expiresAt,
      services: {
        deleteMany: {},
        create: toQuoteServicesCreate(raw),
      },
      paymentOptions: {
        deleteMany: {},
        create: toPaymentOptionsCreate(raw),
      },
      ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
    };
  }

  static toPrismaResolutionUpdate(
    raw: Quote,
  ): Prisma.QuoteUncheckedUpdateInput {
    return {
      customerId: raw.customerId?.toString() ?? null,
      vehicleId: raw.vehicleId?.toString() ?? null,
      updatedAt: raw.updatedAt,
      services: {
        update: raw.services.map((service) => ({
          where: { id: service.quoteServiceId.toString() },
          data: {
            serviceId: service.serviceId?.toString() ?? null,
            serviceName: service.serviceName,
          },
        })),
      },
    };
  }
}
