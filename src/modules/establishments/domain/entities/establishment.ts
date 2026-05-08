import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { Cnpj } from "../value-objects/cnpj";
import { Slug } from "../value-objects/slug";

export type EstablishmentProps = {
  ownerId: UniqueEntityId;
  tradeName: string;
  legalBusinessName: string;
  slug: Slug;
  cnpj: Cnpj;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
};

export type EstablishmentCreateProps = Optional<
  EstablishmentProps,
  "slug" | "profileImageUrl" | "bannerImageUrl"
>;

export class Establishment extends AggregateRoot<EstablishmentProps> {
  get ownerId() {
    return this.props.ownerId;
  }

  get tradeName() {
    return this.props.tradeName;
  }

  get legalBusinessName() {
    return this.props.legalBusinessName;
  }

  get cnpj() {
    return this.props.cnpj;
  }

  get slug() {
    return this.props.slug;
  }

  get profileImageUrl() {
    return this.props.profileImageUrl;
  }

  get bannerImageUrl() {
    return this.props.bannerImageUrl;
  }

  set tradeName(name: string) {
    this.props.tradeName = name;
  }

  setProfileImageUrl(url: string) {
    const normalized = Establishment.normalizeOptionalUrl(url);
    if (normalized === null) {
      throw new Error("profile image URL cannot be empty.");
    }
    this.props.profileImageUrl = normalized;
  }

  setBannerImageUrl(url: string) {
    const normalized = Establishment.normalizeOptionalUrl(url);
    if (normalized === null) {
      throw new Error("banner image URL cannot be empty.");
    }
    this.props.bannerImageUrl = normalized;
  }

  static create(props: EstablishmentCreateProps, id?: UniqueEntityId) {
    const establishment = new Establishment(
      {
        ...props,
        slug: props.slug ?? Slug.createFromText(props.tradeName),
        profileImageUrl: Establishment.normalizeOptionalUrl(
          props.profileImageUrl,
        ),
        bannerImageUrl: Establishment.normalizeOptionalUrl(
          props.bannerImageUrl,
        ),
      },
      id,
    );
    return establishment;
  }

  static restore(props: EstablishmentProps, id?: UniqueEntityId) {
    return new Establishment(
      {
        ...props,
        profileImageUrl: Establishment.normalizeOptionalUrl(
          props.profileImageUrl,
        ),
        bannerImageUrl: Establishment.normalizeOptionalUrl(
          props.bannerImageUrl,
        ),
      },
      id,
    );
  }

  private static normalizeOptionalUrl(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }
}
