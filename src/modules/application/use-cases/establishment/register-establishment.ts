import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { PersistenceError } from "../../../../shared/errors/persistence-error";
import { UniqueConstraintViolationError } from "../../../../shared/errors/unique-constraint-violation-error";
import { User } from "../../../accounts/domain/entities/user";
import {
  Address,
  AddressCreateInput,
  InvalidAddressError,
} from "../../../accounts/domain/value-objects/address";
import {
  Email,
  InvalidEmailError,
} from "../../../accounts/domain/value-objects/email";
import {
  InvalidPhoneError,
  Phone,
} from "../../../accounts/domain/value-objects/phone";
import { UserRole } from "../../../accounts/domain/value-objects/user-role";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { InvalidRegisterEstablishmentInputError } from "../../../establishments/domain/errors/invalid-register-establishment-input-error";
import {
  Cnpj,
  InvalidCnpjError,
} from "../../../establishments/domain/value-objects/cnpj";
import { OperatingHours } from "../../../establishments/domain/value-objects/operating-hours";
import { Slug } from "../../../establishments/domain/value-objects/slug";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";
import { HashGenerator } from "../../repositories/hash-generator";
import { UnitOfWork } from "../../repositories/unit-of-work";
import { UsersRepository } from "../../repositories/users-repository";

type RegisterEstablishmentUseCaseRequest = {
  name: string;
  tradeName: string;
  legalBusinessName: string;
  email: string;
  password: string;
  cnpj: string;
  phone: string;
  address: AddressCreateInput;
  slug?: string | undefined;
};

type RegisterEstablishmentUseCaseResponse = Either<
  | ResourceAlreadyExistsError
  | InvalidRegisterEstablishmentInputError
  | UnexpectedDomainError,
  {
    establishment: Establishment;
  }
>;

@Injectable()
export class RegisterEstablishmentUseCase {
  constructor(
    private usersRepository: UsersRepository,
    private establishmentsRepository: EstablishmentsRepository,
    private hashGenerator: HashGenerator,
    private unitOfWork: UnitOfWork,
  ) {}

  async execute({
    name,
    tradeName,
    legalBusinessName,
    email: rawEmail,
    password,
    cnpj: rawCnpj,
    phone: rawPhone,
    address: rawAddress,
    slug: rawSlug,
  }: RegisterEstablishmentUseCaseRequest): Promise<RegisterEstablishmentUseCaseResponse> {
    const slug = rawSlug
      ? Slug.create(rawSlug)
      : Slug.createFromText(tradeName);

    let email;
    let cnpj;
    const operatingHours = OperatingHours.create({ days: [] });
    let phone;
    let address;

    try {
      email = new Email(rawEmail);
      cnpj = Cnpj.create(rawCnpj);
      phone = Phone.create(rawPhone);
      address = Address.create(rawAddress);
    } catch (error) {
      if (
        error instanceof InvalidEmailError ||
        error instanceof InvalidCnpjError ||
        error instanceof InvalidPhoneError ||
        error instanceof InvalidAddressError
      ) {
        return left(new InvalidRegisterEstablishmentInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    let establishmentWithTheSameSlugOrCnpj;
    let userWithTheSameEmail;

    try {
      [establishmentWithTheSameSlugOrCnpj, userWithTheSameEmail] =
        await Promise.all([
          this.establishmentsRepository.findBySlugOrCnpj(
            slug.value,
            cnpj.value,
          ),
          this.usersRepository.findByEmail(email.toString()),
        ]);
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        return left(
          new ResourceAlreadyExistsError("Establishment already registered."),
        );
      }

      if (error instanceof PersistenceError) {
        return left(new UnexpectedDomainError());
      }

      return left(new UnexpectedDomainError());
    }

    if (establishmentWithTheSameSlugOrCnpj || userWithTheSameEmail) {
      return left(
        new ResourceAlreadyExistsError("Establishment already registered."),
      );
    }

    const userRole: UserRole = "ESTABLISHMENT";

    const hashedPassword = await this.hashGenerator.hash(password);

    const userInputValues = {
      name,
      email,
      hashedPassword,
      role: userRole,
      phone,
      address,
    };

    const user = User.create(userInputValues);

    const establishment = Establishment.create({
      ownerId: user.id,
      cnpj,
      tradeName,
      legalBusinessName,
      operatingHours,
      slug,
    });

    try {
      await this.unitOfWork.execute(async () => {
        await this.usersRepository.create(user);
        await this.establishmentsRepository.create(establishment);
      });
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        return left(
          new ResourceAlreadyExistsError("Establishment already registered."),
        );
      }

      if (error instanceof PersistenceError) {
        return left(new UnexpectedDomainError());
      }

      return left(new UnexpectedDomainError());
    }

    return right({
      establishment,
    });
  }
}
