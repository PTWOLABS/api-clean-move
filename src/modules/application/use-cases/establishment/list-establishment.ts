import { Either, right } from "../../../../shared/either";
import { Establishment } from "../../../establishments/domain/entities/establishment";
import { EstablishmentsRepository } from "../../repositories/establishment-repository";

type ListEstablishmentsUseCaseRequest = {
  filters?: {
    establishmentName?: string;
    serviceCategoryId?: string;
  };
};

type ListEstablishmentsUseCaseResponse = Either<
  [],
  {
    establishments: Establishment[];
  }
>;

export class ListEstablishmentsUseCase {
  constructor(private establishmentsRepository: EstablishmentsRepository) {}

  async execute({
    filters,
  }: ListEstablishmentsUseCaseRequest): Promise<ListEstablishmentsUseCaseResponse> {
    const establishments =
      await this.establishmentsRepository.findMany(filters);

    return right({
      establishments,
    });
  }
}
