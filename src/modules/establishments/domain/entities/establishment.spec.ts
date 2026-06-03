import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Cnpj } from "../value-objects/cnpj";
import { Establishment } from "./establishment";

describe("Establishment", () => {
  it("should create an OAuth draft with nullable commercial fields", () => {
    const ownerId = new UniqueEntityId();

    const establishment = Establishment.createOAuthDraft({ ownerId });

    expect(establishment.ownerId).toEqual(ownerId);
    expect(establishment.tradeName).toBeNull();
    expect(establishment.legalBusinessName).toBeNull();
    expect(establishment.slug).toBeNull();
    expect(establishment.cnpj).toBeNull();
    expect(establishment.bannerImageUrl).toBeNull();
  });

  it("should merge commercial profile updates partially", () => {
    const establishment = Establishment.createOAuthDraft({
      ownerId: new UniqueEntityId(),
    });

    establishment.updateCommercialProfile({
      tradeName: "Clean Move",
      cnpj: "61911322000187",
    });

    expect(establishment.tradeName).toBe("Clean Move");
    expect(establishment.cnpj?.toString()).toBe("61911322000187");
    expect(establishment.slug).toBeNull();
  });
});
