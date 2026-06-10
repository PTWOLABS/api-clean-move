import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { Cnpj } from "../value-objects/cnpj";
import { Slug } from "../value-objects/slug";

export type EstablishmentProps = {
  ownerId: UniqueEntityId;
  tradeName: string | null;
  legalBusinessName: string | null;
  slug: Slug | null;
  cnpj: Cnpj | null;
  bannerImageUrl: string | null;
};

export type EstablishmentCreateProps = Optional<
  EstablishmentProps,
  "tradeName" | "legalBusinessName" | "slug" | "cnpj" | "bannerImageUrl"
>;

export type EstablishmentCommercialProfileUpdate = {
  tradeName?: string;
  legalBusinessName?: string;
  cnpj?: string;
  slug?: string;
};

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

  get bannerImageUrl() {
    return this.props.bannerImageUrl;
  }

  setBannerImageUrl(url: string) {
    const normalized = Establishment.normalizeOptionalUrl(url);
    if (normalized === null) {
      throw new Error("banner image URL cannot be empty.");
    }
    this.props.bannerImageUrl = normalized;
  }

  clearBannerImageUrl() {
    this.props.bannerImageUrl = null;
  }

  updateCommercialProfile(data: EstablishmentCommercialProfileUpdate) {
    if (data.tradeName !== undefined) {
      const normalized = data.tradeName.trim();
      if (!normalized) {
        throw new Error("trade name cannot be empty.");
      }
      this.props.tradeName = normalized;
    }

    if (data.legalBusinessName !== undefined) {
      const normalized = data.legalBusinessName.trim();
      if (!normalized) {
        throw new Error("legal business name cannot be empty.");
      }
      this.props.legalBusinessName = normalized;
    }

    if (data.cnpj !== undefined) {
      this.props.cnpj = Cnpj.create(data.cnpj);
    }

    if (data.slug !== undefined) {
      const normalized = data.slug.trim();
      this.props.slug = normalized
        ? Slug.create(normalized)
        : Slug.createFromText(this.props.tradeName ?? "establishment");
    }
  }

  static createOAuthDraft(
    props: { ownerId: UniqueEntityId },
    id?: UniqueEntityId,
  ) {
    return Establishment.create(
      {
        ownerId: props.ownerId,
        tradeName: null,
        legalBusinessName: null,
        slug: null,
        cnpj: null,
        bannerImageUrl: null,
      },
      id,
    );
  }

  static create(props: EstablishmentCreateProps, id?: UniqueEntityId) {
    const tradeName = props.tradeName ?? null;
    const slug =
      props.slug ??
      (tradeName !== null ? Slug.createFromText(tradeName) : null);

    const establishment = new Establishment(
      {
        ...props,
        tradeName,
        legalBusinessName: props.legalBusinessName ?? null,
        slug,
        cnpj: props.cnpj ?? null,
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
