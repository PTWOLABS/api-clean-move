import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { Cnpj } from "../value-objects/cnpj";
import { DayOfWeek, OperatingHours } from "../value-objects/operating-hours";
import { Slug } from "../value-objects/slug";

export type EstablishmentProps = {
  ownerId: UniqueEntityId;
  tradeName: string;
  legalBusinessName: string;
  slug: Slug;
  operatingHours: OperatingHours;
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

  get operatingHours() {
    return this.props.operatingHours;
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

  isOpenDuring(startsAt: Date, endsAt: Date): boolean {
    if (
      startsAt.getFullYear() !== endsAt.getFullYear() ||
      startsAt.getMonth() !== endsAt.getMonth() ||
      startsAt.getDate() !== endsAt.getDate()
    ) {
      return false;
    }

    const dayOfWeekMap: DayOfWeek[] = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];

    const requestedDay = dayOfWeekMap[startsAt.getDay()];
    const requestedStartsAtInMinutes =
      startsAt.getHours() * 60 + startsAt.getMinutes();
    const requestedEndsAtInMinutes =
      endsAt.getHours() * 60 + endsAt.getMinutes();

    return this.operatingHours.days
      .filter((openingDay) => openingDay.day === requestedDay)
      .some((openingDay) =>
        openingDay.ranges.some((range) => {
          const [startHour, startMinute] = range.start.split(":").map(Number);
          const [endHour, endMinute] = range.end.split(":").map(Number);

          if (
            startHour === undefined ||
            startMinute === undefined ||
            endHour === undefined ||
            endMinute === undefined
          ) {
            return false;
          }

          const rangeStartsAtInMinutes = startHour * 60 + startMinute;
          const rangeEndsAtInMinutes = endHour * 60 + endMinute;

          return (
            requestedStartsAtInMinutes >= rangeStartsAtInMinutes &&
            requestedEndsAtInMinutes <= rangeEndsAtInMinutes
          );
        }),
      );
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
