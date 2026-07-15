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

    if (hasExactColumns(columns, ["establishment_id", "cpf_cnpj"])) {
      return "CUSTOMER_DOCUMENT";
    }

    if (hasExactColumns(columns, ["establishment_id", "plate"])) {
      return "VEHICLE_PLATE";
    }

    if (hasExactColumns(columns, ["establishment_id", "service_name"])) {
      return "SERVICE_NAME";
    }

    return "UNKNOWN";
  }

  if (typeof target !== "string") {
    return "UNKNOWN";
  }

  const constraintName = target.toLowerCase();

  const resource = CONSTRAINT_RESOURCE_BY_NAME[constraintName];

  if (resource) {
    return resource;
  }

  return "UNKNOWN";
}

const CONSTRAINT_RESOURCE_BY_NAME: Record<string, UniqueConstraintResource> = {
  customers_active_establishment_cpf_cnpj_unique: "CUSTOMER_DOCUMENT",
  customers_establishment_cpf_cnpj_active_unique: "CUSTOMER_DOCUMENT",
  customer_vehicles_active_establishment_plate_unique: "VEHICLE_PLATE",
  customer_vehicles_establishment_plate_active_unique: "VEHICLE_PLATE",
  services_active_establishment_name_unique: "SERVICE_NAME",
};

function hasExactColumns(columns: string[], expected: string[]) {
  if (columns.length !== expected.length) {
    return false;
  }

  const columnSet = new Set(columns);

  return expected.every((column) => columnSet.has(column));
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
