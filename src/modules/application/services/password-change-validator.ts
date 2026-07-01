import { Injectable } from "@nestjs/common";

import { Either, left, right } from "../../../shared/either";
import { InvalidCurrentPasswordError } from "../../../shared/errors/invalid-current-password-error";
import { SamePasswordError } from "../../../shared/errors/same-password-error";
import { User } from "../../accounts/domain/entities/user";
import { HashComparer } from "../repositories/hash-comparer";
import { InvalidUserPasswordUpdateInputError } from "../../../shared/errors/invalid-user-password-update-input-error";

type ValidatePasswordChangeInput = {
  user: User;
  newPassword: string;
  currentPassword?: string;
};

type PasswordChangeValidationError =
  | InvalidUserPasswordUpdateInputError
  | InvalidCurrentPasswordError
  | SamePasswordError;

@Injectable()
export class PasswordChangeValidator {
  constructor(private hashComparer: HashComparer) {}

  async validate({
    user,
    newPassword,
    currentPassword,
  }: ValidatePasswordChangeInput): Promise<
    Either<PasswordChangeValidationError, void>
  > {
    if (user.hashedPassword === null) {
      if (currentPassword !== undefined) {
        return left(
          new InvalidUserPasswordUpdateInputError(
            "Current password must not be provided when setting the first local password.",
          ),
        );
      }
    } else {
      if (currentPassword === undefined) {
        return left(
          new InvalidUserPasswordUpdateInputError(
            "Current password is required to update an existing local password.",
          ),
        );
      }

      const isCurrentPasswordValid = await this.hashComparer.compare(
        currentPassword,
        user.hashedPassword,
      );

      if (!isCurrentPasswordValid) {
        return left(new InvalidCurrentPasswordError());
      }

      const isSamePassword = await this.hashComparer.compare(
        newPassword,
        user.hashedPassword,
      );

      if (isSamePassword) {
        return left(new SamePasswordError());
      }
    }

    return right(undefined);
  }
}
