import { Injectable } from "@nestjs/common";

import { CustomerVehicle } from "../../../customer/domain/entities/customer-vehicle";
import { Quote } from "../../../quotes/domain/entities/quote";
import { CustomerVehiclesRepository } from "../../repositories/customer-vehicles-repository";
import { QuoteVehicleAnalysis } from "./quote-approval-analysis";
import { normalizeQuoteApprovalPlate } from "./quote-approval-evidence";

type QuoteVehicleMatcherInput = {
  quote: Quote;
  establishmentId: string;
  resolvedCustomerId: string | null;
};

@Injectable()
export class QuoteVehicleMatcher {
  constructor(
    private readonly customerVehiclesRepository: CustomerVehiclesRepository,
  ) {}

  async analyze({
    quote,
    establishmentId,
    resolvedCustomerId,
  }: QuoteVehicleMatcherInput): Promise<QuoteVehicleAnalysis> {
    if (!quote.vehicle) {
      return {
        status: "NONE",
        requiresResolution: false,
        candidateVehicleId: null,
        candidateCustomerId: null,
        allowedActions: [],
      };
    }

    if (quote.vehicleId) {
      return this.analyzeLinkedVehicle(quote, establishmentId);
    }

    const plate = normalizeQuoteApprovalPlate(quote.vehicle.plate);

    if (!plate) {
      return snapshotOnly();
    }

    const candidate =
      await this.customerVehiclesRepository.findActiveByPlateAndEstablishmentId(
        plate,
        establishmentId,
      );

    if (!candidate) {
      return snapshotOnly();
    }

    if (!resolvedCustomerId) {
      return plateConflict(candidate);
    }

    if (candidate.customerId.toString() !== resolvedCustomerId) {
      return {
        status: "OWNERSHIP_CONFLICT",
        requiresResolution: true,
        candidateVehicleId: candidate.id.toString(),
        candidateCustomerId: candidate.customerId.toString(),
        allowedActions: ["EDIT_SNAPSHOT_PLATE", "KEEP_SNAPSHOT_ONLY"],
      };
    }

    return candidateFound(candidate);
  }

  private async analyzeLinkedVehicle(
    quote: Quote,
    establishmentId: string,
  ): Promise<QuoteVehicleAnalysis> {
    const vehicle =
      await this.customerVehiclesRepository.findByIdAndEstablishmentIdIncludingDeleted(
        quote.vehicleId!.toString(),
        establishmentId,
      );

    if (!vehicle || vehicle.isDeleted()) {
      return {
        status: "LINKED_RESOURCE_DELETED",
        requiresResolution: true,
        candidateVehicleId: null,
        candidateCustomerId: null,
        allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
      };
    }

    return {
      status: "RESOLVED",
      requiresResolution: false,
      candidateVehicleId: vehicle.id.toString(),
      candidateCustomerId: vehicle.customerId.toString(),
      allowedActions: [],
    };
  }
}

function snapshotOnly(): QuoteVehicleAnalysis {
  return {
    status: "SNAPSHOT_ONLY",
    requiresResolution: true,
    candidateVehicleId: null,
    candidateCustomerId: null,
    allowedActions: ["CREATE_FROM_SNAPSHOT", "KEEP_SNAPSHOT_ONLY"],
  };
}

function candidateFound(candidate: CustomerVehicle): QuoteVehicleAnalysis {
  return {
    status: "CANDIDATE_FOUND",
    requiresResolution: true,
    candidateVehicleId: candidate.id.toString(),
    candidateCustomerId: candidate.customerId.toString(),
    allowedActions: ["LINK_EXISTING", "KEEP_SNAPSHOT_ONLY"],
  };
}

function plateConflict(candidate: CustomerVehicle): QuoteVehicleAnalysis {
  return {
    status: "CANDIDATE_FOUND",
    requiresResolution: true,
    candidateVehicleId: candidate.id.toString(),
    candidateCustomerId: candidate.customerId.toString(),
    allowedActions: ["EDIT_SNAPSHOT_PLATE", "KEEP_SNAPSHOT_ONLY"],
  };
}
