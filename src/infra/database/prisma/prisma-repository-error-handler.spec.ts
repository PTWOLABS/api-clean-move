import { Prisma } from "../../../generated/prisma/client";
import { UniqueConstraintViolationError } from "../../../shared/errors/unique-constraint-violation-error";
import {
  mapPrismaConstraintTarget,
  rethrowPrismaRepositoryError,
} from "./prisma-repository-error-handler";

describe("Prisma repository error handler", () => {
  it("should map known unique constraint targets", () => {
    expect(mapPrismaConstraintTarget(["establishment_id", "cpf_cnpj"])).toBe(
      "CUSTOMER_DOCUMENT",
    );
    expect(mapPrismaConstraintTarget(["establishment_id", "plate"])).toBe(
      "VEHICLE_PLATE",
    );
    expect(mapPrismaConstraintTarget(["establishment_id", "service_name"])).toBe(
      "SERVICE_NAME",
    );
    expect(mapPrismaConstraintTarget(undefined)).toBe("UNKNOWN");
    expect(mapPrismaConstraintTarget(["service_name"])).toBe("UNKNOWN");
  });

  it("should map known unique constraint names", () => {
    expect(
      mapPrismaConstraintTarget("customers_active_establishment_cpf_cnpj_unique"),
    ).toBe("CUSTOMER_DOCUMENT");
    expect(
      mapPrismaConstraintTarget(
        "customer_vehicles_active_establishment_plate_unique",
      ),
    ).toBe("VEHICLE_PLATE");
    expect(
      mapPrismaConstraintTarget("services_active_establishment_name_unique"),
    ).toBe("SERVICE_NAME");
    expect(mapPrismaConstraintTarget("legacy_service_name_constraint")).toBe(
      "UNKNOWN",
    );
  });

  it("should preserve the violated resource on P2002 errors", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: {
          target: ["establishment_id", "plate"],
        },
      },
    );

    expect(() => rethrowPrismaRepositoryError(error)).toThrow(
      UniqueConstraintViolationError,
    );

    try {
      rethrowPrismaRepositoryError(error);
    } catch (caught) {
      expect(caught).toBeInstanceOf(UniqueConstraintViolationError);
      expect((caught as UniqueConstraintViolationError).resource).toBe(
        "VEHICLE_PLATE",
      );
    }
  });
});
