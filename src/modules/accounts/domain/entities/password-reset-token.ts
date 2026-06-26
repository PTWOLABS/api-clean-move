import { Entity } from "../../../../shared/entities/entity";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export type PasswordResetTokenProps = {
  userId: UniqueEntityId;
  hashedToken: string;
  expiresAt: Date;
};

export class PasswordResetToken extends Entity<PasswordResetTokenProps> {
  get userId() {
    return this.props.userId;
  }

  get hashedToken() {
    return this.props.hashedToken;
  }

  get expiresAt() {
    return this.props.expiresAt;
  }

  isExpired(reference: Date): boolean {
    return reference.getTime() >= this.props.expiresAt.getTime();
  }

  static create(props: PasswordResetTokenProps, id?: UniqueEntityId) {
    return new PasswordResetToken(props, id);
  }
}
