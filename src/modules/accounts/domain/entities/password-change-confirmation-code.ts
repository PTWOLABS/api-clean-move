import { Entity } from "../../../../shared/entities/entity";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export const MAX_FAILED_ATTEMPTS = 5;

export type PasswordChangeConfirmationCodeProps = {
  userId: UniqueEntityId;
  hashedCode: string;
  pendingPasswordHash: string;
  expiresAt: Date;
  failedAttempts: number;
};

export class PasswordChangeConfirmationCode extends Entity<PasswordChangeConfirmationCodeProps> {
  get userId() {
    return this.props.userId;
  }

  get hashedCode() {
    return this.props.hashedCode;
  }

  get pendingPasswordHash() {
    return this.props.pendingPasswordHash;
  }

  get failedAttempts() {
    return this.props.failedAttempts;
  }

  get expiresAt() {
    return this.props.expiresAt;
  }

  isExpired(reference: Date): boolean {
    return reference.getTime() >= this.props.expiresAt.getTime();
  }

  incrementFailedAttempts(): void {
    this.props.failedAttempts += 1;
  }

  static create(
    props: PasswordChangeConfirmationCodeProps,
    id?: UniqueEntityId,
  ) {
    return new PasswordChangeConfirmationCode(props, id);
  }
}
