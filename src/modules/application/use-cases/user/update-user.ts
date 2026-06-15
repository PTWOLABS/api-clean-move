import { Injectable } from "@nestjs/common";
import { User } from "../../../accounts/domain/entities/user";
import {
  AddressCreateInput,
  InvalidAddressError,
} from "../../../accounts/domain/value-objects/address";
import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UsersRepository } from "../../repositories/users-repository";
import { UserEstablishmentResolver } from "../../services/user-establishment-resolver";
import { InvalidEmailError } from "../../../accounts/domain/value-objects/email";
import { InvalidPhoneError } from "../../../accounts/domain/value-objects/phone";
import { InvalidServiceUpdateInputError } from "../service/update-service";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";

type UpdateUserUseCaseRequest = {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: AddressCreateInput;
};

export class InvalidUserUpdateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserUpdateInputError";
  }
}

type UpdateUserUseCaseResponse = Either<
  | ResourceNotFoundError
  | ResourceAlreadyExistsError
  | InvalidServiceUpdateInputError,
  {
    user: User;
    establishmentId: string | null;
  }
>;

@Injectable()
export class UpdateUserUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private userEstablishmentResolver: UserEstablishmentResolver,
  ) {}

  async execute({
    userId,
    name,
    email,
    phone,
    address,
  }: UpdateUserUseCaseRequest): Promise<UpdateUserUseCaseResponse> {
    const existingUser = await this.usersRepository.findById(userId);

    if (!existingUser) {
      return left(new ResourceNotFoundError({ resource: "user" }));
    }

    if (email !== undefined) {
      const userWithTheSameEmail = await this.usersRepository.findByEmail(
        email.toString(),
      );

      if (
        userWithTheSameEmail &&
        !userWithTheSameEmail.id.equals(existingUser.id)
      ) {
        return left(new ResourceAlreadyExistsError("Email already in use."));
      }
    }

    try {
      existingUser.update({
        name,
        email,
        phone,
        address,
      });
    } catch (error) {
      if (
        error instanceof InvalidEmailError ||
        error instanceof InvalidPhoneError ||
        error instanceof InvalidAddressError
      ) {
        return left(new InvalidUserUpdateInputError(error.message));
      }
      return left(new UnexpectedDomainError());
    }

    await this.usersRepository.save(existingUser);

    const establishmentId =
      await this.userEstablishmentResolver.resolveEstablishmentId(existingUser);

    return right({
      user: existingUser,
      establishmentId,
    });
  }
}
