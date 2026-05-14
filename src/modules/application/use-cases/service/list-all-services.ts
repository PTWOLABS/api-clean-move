import { Injectable } from "@nestjs/common";

import { Service } from "../../../catalog/domain/entities/services";
import {
  type ServiceFilters,
  ServicesRepository,
} from "../../repositories/services-repository";

type ListAllServicesUseCaseRequest = {
  filters?: ServiceFilters;
};

@Injectable()
export class ListAllServicesUseCase {
  constructor(private servicesRepository: ServicesRepository) {}

  async execute({
    filters,
  }: ListAllServicesUseCaseRequest): Promise<{ services: Service[] }> {
    const services = await this.servicesRepository.findMany(filters);

    return {
      services,
    };
  }
}
