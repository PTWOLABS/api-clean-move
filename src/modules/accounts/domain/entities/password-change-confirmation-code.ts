import { Entity } from "../../../../shared/entities/entity";
import { UniqueEntityId } from "../../../../shared/entities/unique-entity-id";

export type PasswordChangeConfirmationCodeProps = {
  userId: UniqueEntityId;
  hashedCode: string;
  expiresAt: Date;
};

export class PasswordChangeConfirmationCode extends Entity<PasswordChangeConfirmationCodeProps> {
  get userId() {
    return this.props.userId;
  }

  get hashedCode() {
    return this.props.hashedCode;
  }

  get expiresAt() {
    return this.props.expiresAt;
  }

  isExpired(reference: Date): boolean {
    return reference.getTime() >= this.props.expiresAt.getTime();
  }

  static create(
    props: PasswordChangeConfirmationCodeProps,
    id?: UniqueEntityId,
  ) {
    return new PasswordChangeConfirmationCode(props, id);
  }
}
