import z from "zod";

import { QuoteCustomerResolution } from "../../../../modules/application/services/quote-approval/quote-approval-analysis";

export const quoteIdParamSchema = z.uuid();

export const customerResolutionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("LINK_EXISTING"),
      customerId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("CREATE_NEW"),
      email: z.email().trim().optional().nullable(),
      phone: z.string().trim().min(1).optional().nullable(),
    })
    .strict(),
]);

export const vehicleResolutionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("LINK_EXISTING"),
      vehicleId: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("CREATE_FROM_SNAPSHOT"),
    })
    .strict(),
  z
    .object({
      action: z.literal("KEEP_SNAPSHOT_ONLY"),
    })
    .strict(),
  z
    .object({
      action: z.literal("EDIT_SNAPSHOT_PLATE"),
      plate: z
        .string()
        .trim()
        .refine((plate) => normalizePlate(plate).length === 7),
    })
    .strict(),
]);

export const serviceResolutionSchema = z.discriminatedUnion("action", [
  z
    .object({
      quoteServiceId: z.uuid(),
      action: z.literal("ASSOCIATE_EXISTING"),
      serviceId: z.uuid(),
    })
    .strict(),
  z
    .object({
      quoteServiceId: z.uuid(),
      action: z.literal("KEEP_INACTIVE_LINK"),
    })
    .strict(),
  z
    .object({
      quoteServiceId: z.uuid(),
      action: z.literal("RENAME_DETACHED"),
      serviceName: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      quoteServiceId: z.uuid(),
      action: z.literal("RECREATE_FROM_SNAPSHOT"),
    })
    .strict(),
]);

export const quoteApprovalScheduleSchema = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
});

export function toQuoteCustomerResolution(
  input: z.infer<typeof customerResolutionSchema>,
): QuoteCustomerResolution {
  if (input.action === "LINK_EXISTING") {
    return input;
  }

  return {
    action: "CREATE_NEW",
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  };
}

function normalizePlate(plate: string) {
  return plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}
