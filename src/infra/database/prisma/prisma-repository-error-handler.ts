import { Prisma } from "../../../generated/prisma/client";
import { PersistenceError } from "../../../shared/errors/persistence-error";
import {
  UniqueConstraintResource,
  UniqueConstraintViolationError,
} from "../../../shared/errors/unique-constraint-violation-error";

export function mapPrismaConstraintTarget(
  target: unknown,
): UniqueConstraintResource {
  if (Array.isArray(target)) {
    const columns = target
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.toLowerCase());

    if (columns.includes("cpf_cnpj")) {
      return "CUSTOMER_DOCUMENT";
    }

    if (columns.includes("plate")) {
      return "VEHICLE_PLATE";
    }

    if (columns.includes("service_name")) {
      return "SERVICE_NAME";
    }

    return "UNKNOWN";
  }

  if (typeof target !== "string") {
    return "UNKNOWN";
  }

  const constraintName = target.toLowerCase();

  if (
    constraintName.includes("customers_active_establishment_cpf_cnpj_unique") ||
    constraintName.includes("customers_establishment_cpf_cnpj_active_unique")
  ) {
    return "CUSTOMER_DOCUMENT";
  }

  if (
    constraintName.includes(
      "customer_vehicles_active_establishment_plate_unique",
    ) ||
    constraintName.includes("customer_vehicles_establishment_plate_active_unique")
  ) {
    return "VEHICLE_PLATE";
  }

  if (
    constraintName.includes("services_active_establishment_name_unique") ||
    constraintName.includes("service_name")
  ) {
    return "SERVICE_NAME";
  }

  return "UNKNOWN";
}

export function rethrowPrismaRepositoryError(error: unknown): never {
  if (error instanceof UniqueConstraintViolationError) {
    throw error;
  }

  if (error instanceof PersistenceError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new UniqueConstraintViolationError(
        mapPrismaConstraintTarget(error.meta?.target),
      );
    }

    throw new PersistenceError();
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new PersistenceError();
  }

  if (error instanceof Error) {
    throw new PersistenceError();
  }

  throw new PersistenceError();
}
