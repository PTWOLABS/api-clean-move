import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { makeServiceCategoryRef } from "../../../../../tests/helpers/service-category-ref";
import {
  BookedServiceSnapshot,
  InvalidBookedServiceSnapshotError,
} from "./booked-service-snapshot";

const protectionCategory = makeServiceCategoryRef("Proteção");
const washCategory = makeServiceCategoryRef("Lavagem");

describe("BookedServiceSnapshot", () => {
  it("should be able to create a valid service snapshot", () => {
    const serviceId = new UniqueEntityId();

    const snapshot = BookedServiceSnapshot.create({
      serviceId,
      serviceName: "Lavagem premium",
      category: protectionCategory,
      durationInMinutes: 90,
      priceInCents: 15000,
    });

    expect(snapshot.serviceId.equals(serviceId)).toBe(true);
    expect(snapshot.serviceName).toBe("Lavagem premium");
    expect(snapshot.category).toEqual(protectionCategory);
    expect(snapshot.durationInMinutes).toBe(90);
    expect(snapshot.priceInCents).toBe(15000);
    expect(snapshot.price).toBe(150);
  });

  it("should normalize the service name by trimming blank spaces", () => {
    const snapshot = BookedServiceSnapshot.create({
      serviceId: new UniqueEntityId(),
      serviceName: "  Lavagem simples  ",
      category: washCategory,
      durationInMinutes: 60,
      priceInCents: 7500,
    });

    expect(snapshot.serviceName).toBe("Lavagem simples");
  });

  it("should allow category and duration to be omitted", () => {
    const snapshot = BookedServiceSnapshot.create({
      serviceId: new UniqueEntityId(),
      serviceName: "Lavagem simples",
      priceInCents: 7500,
    });

    expect(snapshot.category).toBeUndefined();
    expect(snapshot.durationInMinutes).toBeUndefined();
  });

  it("should not allow an empty service name", () => {
    expect(() =>
      BookedServiceSnapshot.create({
        serviceId: new UniqueEntityId(),
        serviceName: "   ",
        category: washCategory,
        durationInMinutes: 60,
        priceInCents: 7500,
      }),
    ).toThrow(InvalidBookedServiceSnapshotError);
  });

  it("should not allow a non-positive duration", () => {
    expect(() =>
      BookedServiceSnapshot.create({
        serviceId: new UniqueEntityId(),
        serviceName: "Lavagem simples",
        category: washCategory,
        durationInMinutes: 0,
        priceInCents: 7500,
      }),
    ).toThrow(InvalidBookedServiceSnapshotError);
  });

  it("should not allow a negative price", () => {
    expect(() =>
      BookedServiceSnapshot.create({
        serviceId: new UniqueEntityId(),
        serviceName: "Lavagem simples",
        category: washCategory,
        durationInMinutes: 60,
        priceInCents: -1,
      }),
    ).toThrow(InvalidBookedServiceSnapshotError);
  });
});
