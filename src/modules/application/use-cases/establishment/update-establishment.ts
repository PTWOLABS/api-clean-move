import { Injectable } from "@nestjs/common";
import { Either, left, right } from "../../../../shared/either";
import { ResourceAlreadyExistsError } from "../../../../shared/errors/resource-already-exists-error";
import { ResourceNotFoundError } from "../../../../shared/errors/resource-not-found-error";
import { UnexpectedDomainError } from "../../../../shared/errors/unexpected-domain-error";
import { InvalidCnpjError } from "../../../establishments/domain/value-objects/cnpj";
import { InvalidUpdateEstablishmentInputError } from "../../../establishments/domain/errors/invalid-update-establishment-input-error";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type UpdateEstablishmentUseCaseRequest = {
  ownerId: string;
  tradeName?: string;
  legalBusinessName?: string;
  cnpj?: string;
  slug?: string;
};

type UpdateEstablishmentUseCaseResponse = Either<
  | ResourceNotFoundError
  | ResourceAlreadyExistsError
  | InvalidUpdateEstablishmentInputError
  | UnexpectedDomainError,
  { establishment: Establishment }
>;

@Injectable()
export class UpdateEstablishmentUseCase {
  constructor(private establishmentsRepository: EstablishmentsRepository) {}

  async execute({
    ownerId,
    tradeName,
    legalBusinessName,
    cnpj,
    slug,
  }: UpdateEstablishmentUseCaseRequest): Promise<UpdateEstablishmentUseCaseResponse> {
    const establishment =
      await this.establishmentsRepository.findByOwnerId(ownerId);

    if (!establishment) {
      return left(new ResourceNotFoundError({ resource: "establishment" }));
    }

    if (slug !== undefined) {
      const conflict = await this.establishmentsRepository.findBySlug(slug);
      if (conflict && !conflict.id.equals(establishment.id)) {
        return left(
          new ResourceAlreadyExistsError("Establishment already registered."),
        );
      }
    }

    if (cnpj !== undefined) {
      const conflict = await this.establishmentsRepository.findByCnpj(cnpj);
      if (conflict && !conflict.id.equals(establishment.id)) {
        return left(
          new ResourceAlreadyExistsError("Establishment already registered."),
        );
      }
    }

    try {
      establishment.updateCommercialProfile({
        ...(tradeName !== undefined ? { tradeName } : {}),
        ...(legalBusinessName !== undefined ? { legalBusinessName } : {}),
        ...(cnpj !== undefined ? { cnpj } : {}),
        ...(slug !== undefined ? { slug } : {}),
      });
    } catch (error) {
      if (error instanceof InvalidCnpjError) {
        return left(new InvalidUpdateEstablishmentInputError(error.message));
      }

      if (error instanceof Error) {
        return left(new InvalidUpdateEstablishmentInputError(error.message));
      }

      return left(new UnexpectedDomainError());
    }

    await this.establishmentsRepository.save(establishment);

    return right({ establishment });
  }
}
