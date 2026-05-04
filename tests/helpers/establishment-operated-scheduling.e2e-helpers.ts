import z from "zod";

export {
  makeCustomerAuth,
  makeEstablishmentAuth,
} from "./auth-session.e2e-helpers";

export const customerResponseSchema = z.object({
  customer: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    cpfCnpj: z.string().nullable(),
    documentType: z.enum(["CPF", "CNPJ"]).nullable(),
    fullName: z.string(),
    phone: z.string(),
    email: z.email(),
    address: z
      .object({
        street: z.string(),
        country: z.string(),
        state: z.string(),
        zipCode: z.string(),
        city: z.string(),
      })
      .nullable(),
    birthDate: z.string().nullable(),
    nickname: z.string().nullable(),
    deletedAt: z.string().nullable(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
});

export const listCustomersResponseSchema = z.object({
  customers: z.array(customerResponseSchema.shape.customer),
});

export const vehicleResponseSchema = z.object({
  vehicle: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    customerId: z.uuid(),
    plate: z.string().nullable(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    color: z.string().nullable(),
    year: z.number().int().nullable(),
    notes: z.string().nullable(),
    deletedAt: z.string().nullable(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
});

export const listVehiclesResponseSchema = z.object({
  vehicles: z.array(vehicleResponseSchema.shape.vehicle),
});

export const appointmentStatusSchema = z.enum([
  "SCHEDULED",
  "DONE",
  "CANCELLED",
]);

export const appointmentResponseSchema = z.object({
  appointment: z.object({
    id: z.uuid(),
    establishmentId: z.uuid(),
    customerId: z.uuid(),
    vehicleId: z.uuid().nullable(),
    service: z.object({
      id: z.uuid(),
      name: z.string(),
      category: z.string().nullable(),
      durationInMinutes: z.number().int().nullable(),
      priceInCents: z.number().int(),
    }),
    vehicle: z
      .object({
        plate: z.string().nullable(),
        brand: z.string().nullable(),
        model: z.string().nullable(),
        color: z.string().nullable(),
        year: z.number().int().nullable(),
      })
      .nullable(),
    startsAt: z.string(),
    endsAt: z.string().nullable(),
    description: z.string().nullable(),
    discountInCents: z.number().int().nullable(),
    status: appointmentStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    doneAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
  }),
});

export const listAppointmentsResponseSchema = z.object({
  appointments: z.array(appointmentResponseSchema.shape.appointment),
});

type CustomerPayloadOverrides = {
  cpfCnpj?: string | null;
  fullName?: string;
  phone?: string;
  email?: string;
  address?: {
    street: string;
    country: string;
    state: string;
    zipCode: string;
    city: string;
  } | null;
  birthDate?: string | null;
  nickname?: string | null;
};

export function validCustomerPayload(overrides: CustomerPayloadOverrides = {}) {
  return {
    cpfCnpj: "529.982.247-25",
    fullName: "Maria Silva",
    phone: "11999999999",
    email: "maria@example.com",
    address: {
      street: "Rua A",
      country: "Brasil",
      state: "SP",
      zipCode: "01001-000",
      city: "Sao Paulo",
    },
    birthDate: "1990-01-01T00:00:00.000Z",
    nickname: "Maria",
    ...overrides,
  };
}

type VehiclePayloadOverrides = {
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  notes?: string | null;
};

export function validVehiclePayload(overrides: VehiclePayloadOverrides = {}) {
  return {
    plate: "abc-1d23",
    brand: "Toyota",
    model: "Corolla",
    color: "Prata",
    year: 2022,
    notes: "Veiculo principal",
    ...overrides,
  };
}

type AppointmentPayloadInput = {
  customerId: string;
  serviceId: string;
  vehicleId?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  description?: string | null;
  discountInCents?: number | null;
};

export function appointmentPayload({
  customerId,
  serviceId,
  vehicleId,
  startsAt = "2026-04-27T10:00:00.000Z",
  endsAt,
  description,
  discountInCents,
}: AppointmentPayloadInput) {
  return {
    customerId,
    serviceId,
    startsAt,
    ...(vehicleId !== undefined ? { vehicleId } : {}),
    ...(endsAt !== undefined ? { endsAt } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(discountInCents !== undefined ? { discountInCents } : {}),
  };
}
