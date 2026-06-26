import { AggregateRoot } from "../../../../shared/entities/aggregate-root";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";
import { Optional } from "../../../../shared/types/optional";
import { UserPasswordChangedEvent } from "../events/user-password-changed-event";
import { ProfileAlreadyCompleteError } from "../errors/profile-already-complete-error";
import { Address, AddressCreateInput } from "../value-objects/address";
import { Email } from "../value-objects/email";
import type { OAuthProvider } from "../value-objects/oauth-provider";
import { Phone } from "../value-objects/phone";
import { UserRole } from "../value-objects/user-role";

export type SocialAccountLink = {
  provider: OAuthProvider;
  subjectId: string;
};

export type UserProps = {
  name: string;
  email: Email;
  hashedPassword: string | null;
  role: UserRole;
  profileImageUrl: string | null;
  phone: Phone | null;
  address: Address | null;
  socialAccounts: SocialAccountLink[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

export class User extends AggregateRoot<UserProps> {
  get name() {
    return this.props.name;
  }
  get email() {
    return this.props.email;
  }
  get hashedPassword() {
    return this.props.hashedPassword;
  }
  get role() {
    return this.props.role;
  }
  get phone() {
    return this.props.phone;
  }
  get address() {
    return this.props.address;
  }

  get profileImageUrl() {
    return this.props.profileImageUrl;
  }

  get socialAccounts(): SocialAccountLink[] {
    return [...this.props.socialAccounts];
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  isProfileComplete(): boolean {
    return this.props.phone !== null && this.props.address !== null;
  }

  touch() {
    this.props.updatedAt = new Date();
  }

  changeName(name: string) {
    const normalizedName = name.trim();

    if (this.props.name === normalizedName) return;

    this.props.name = normalizedName;
    this.touch();
  }

  changeEmail(email: Email) {
    if (this.props.email.equals(email)) return;

    this.props.email = email;
    this.touch();
  }

  changePhone(phone: Phone) {
    if (this.props.phone?.equals(phone)) return;

    this.props.phone = phone;
    this.touch();
  }

  changeAddress(address: Address) {
    if (this.props.address !== null && this.props.address.equals(address)) {
      return;
    }

    this.props.address = address;
    this.touch();
  }

  completeProfile(input: { phone: Phone; address: Address }) {
    if (this.isProfileComplete()) {
      throw new ProfileAlreadyCompleteError();
    }

    this.props.phone = input.phone;
    this.props.address = input.address;
    this.touch();
  }

  changePassword(hashedPassword: string) {
    this.props.hashedPassword = hashedPassword;
    this.touch();
    this.addDomainEvent(new UserPasswordChangedEvent(this));
  }

  linkSocialAccount(provider: OAuthProvider, subjectId: string) {
    const alreadyLinked = this.props.socialAccounts.some(
      (link) => link.provider === provider && link.subjectId === subjectId,
    );

    if (alreadyLinked) {
      return;
    }

    this.props.socialAccounts.push({ provider, subjectId });
    this.touch();
  }

  update(data: {
    name?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    address?: AddressCreateInput | undefined;
    profileImageUrl?: string | null | undefined;
  }) {
    const newEmail = data.email ? new Email(data.email) : undefined;

    const newPhone = data.phone ? Phone.create(data.phone) : undefined;

    const newAddress = data.address ? Address.create(data.address) : undefined;

    if (data.name !== undefined) {
      this.changeName(data.name);
    }

    if (newEmail) {
      this.changeEmail(newEmail);
    }

    if (newPhone) {
      this.changePhone(newPhone);
    }

    if (newAddress) {
      this.changeAddress(newAddress);
    }

    if (data.profileImageUrl !== undefined) {
      this.props.profileImageUrl = User.normalizeOptionalText(
        data.profileImageUrl,
      );
      this.touch();
    }
  }

  static create(
    props: Optional<
      UserProps,
      "createdAt" | "updatedAt" | "socialAccounts" | "profileImageUrl"
    >,
    id?: UniqueEntityId,
  ) {
    const user = new User(
      {
        ...props,
        profileImageUrl: User.normalizeOptionalText(props.profileImageUrl),
        socialAccounts: props.socialAccounts ?? [],
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );

    return user;
  }

  private static normalizeOptionalText(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = value.trim();
    return normalized || null;
  }
}
