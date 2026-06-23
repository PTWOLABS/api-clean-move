import { Prisma } from "../../src/generated/prisma/client";

export const defaultCustomerVehiclePrismaFields = {
  brand: "Toyota",
  model: "Corolla",
} satisfies Pick<Prisma.CustomerVehicleUncheckedCreateInput, "brand" | "model">;

export function buildCustomerVehiclePrismaData(
  data: Omit<Prisma.CustomerVehicleUncheckedCreateInput, "brand" | "model"> &
    Partial<
      Pick<Prisma.CustomerVehicleUncheckedCreateInput, "brand" | "model">
    >,
): Prisma.CustomerVehicleUncheckedCreateInput {
  return {
    ...defaultCustomerVehiclePrismaFields,
    ...data,
  };
}
