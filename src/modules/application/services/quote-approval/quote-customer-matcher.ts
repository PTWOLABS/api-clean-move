import { Injectable } from "@nestjs/common";

import { Customer } from "../../../customer/domain/entities/customer";
import { Quote } from "../../../quotes/domain/entities/quote";
import { CustomersRepository } from "../../repositories/customers-repository";
import {
  CustomerMatchReason,
  QuoteCustomerAnalysis,
  QuoteCustomerCandidate,
} from "./quote-approval-analysis";
import {
  normalizeQuoteApprovalDocument,
  normalizeQuoteApprovalEmail,
  normalizeQuoteApprovalPhone,
  normalizeQuoteApprovalText,
} from "./quote-approval-evidence";

type QuoteCustomerMatcherInput = {
  quote: Quote;
  establishmentId: string;
};

@Injectable()
export class QuoteCustomerMatcher {
  constructor(private readonly customersRepository: CustomersRepository) {}

  async analyze({
    quote,
    establishmentId,
  }: QuoteCustomerMatcherInput): Promise<QuoteCustomerAnalysis> {
    if (quote.customerId) {
      return this.analyzeLinkedCustomer(quote, establishmentId);
    }

    const documentMatch = await this.findDocumentMatch(quote, establishmentId);

    if (documentMatch) {
      return {
        status: "AUTO_LINK",
        requiresResolution: false,
        automaticCustomerId: documentMatch.id.toString(),
        candidates: [],
      };
    }

    const normalizedPhone = normalizeQuoteApprovalPhone(quote.customer.phone);
    const normalizedEmail = normalizeQuoteApprovalEmail(quote.customer.email);
    const normalizedName = normalizeQuoteApprovalText(quote.customer.name);
    const evidence = buildEvidence({
      phone: normalizedPhone,
      email: normalizedEmail,
      fullName: normalizedName,
    });
    const candidatesById = new Map<string, CandidateAccumulator>();

    const evidenceMatches =
      await this.customersRepository.findManyActiveByEvidenceAndEstablishmentId(
        evidence,
        establishmentId,
      );

    for (const customer of evidenceMatches) {
      addCandidate(candidatesById, customer, {
        matchedBy: getEvidenceReasons(customer, evidence),
        quote,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      });
    }

    const candidates = Array.from(candidatesById.values()).map(
      toCustomerCandidate,
    );

    if (candidates.length === 0) {
      return {
        status: "CREATE_REQUIRED",
        requiresResolution: true,
        automaticCustomerId: null,
        candidates: [],
      };
    }

    return {
      status: "CANDIDATES_FOUND",
      requiresResolution: true,
      automaticCustomerId: null,
      candidates,
    };
  }

  private async analyzeLinkedCustomer(
    quote: Quote,
    establishmentId: string,
  ): Promise<QuoteCustomerAnalysis> {
    const customerId = quote.customerId!.toString();
    const customer =
      await this.customersRepository.findByIdAndEstablishmentIdIncludingDeleted(
        customerId,
        establishmentId,
      );

    if (!customer || customer.isDeleted()) {
      return {
        status: "LINKED_RESOURCE_DELETED",
        requiresResolution: true,
        automaticCustomerId: null,
        candidates: [],
      };
    }

    return {
      status: "RESOLVED",
      requiresResolution: false,
      automaticCustomerId: customer.id.toString(),
      candidates: [],
    };
  }

  private async findDocumentMatch(quote: Quote, establishmentId: string) {
    const document = normalizeQuoteApprovalDocument(quote.customer.cpfCnpj);

    if (!document) {
      return null;
    }

    return this.customersRepository.findActiveByCpfCnpjAndEstablishmentId(
      document,
      establishmentId,
    );
  }
}

type CandidateAccumulator = {
  customer: Customer;
  matchedBy: Set<CustomerMatchReason>;
  conflictingFields: Set<"NAME" | "PHONE" | "EMAIL">;
};

function addCandidate(
  candidatesById: Map<string, CandidateAccumulator>,
  customer: Customer,
  input: {
    matchedBy: CustomerMatchReason[];
    quote: Quote;
    email?: string;
  },
) {
  if (input.matchedBy.length === 0) {
    return;
  }

  const customerId = customer.id.toString();
  const current =
    candidatesById.get(customerId) ??
    ({
      customer,
      matchedBy: new Set<CustomerMatchReason>(),
      conflictingFields: new Set<"NAME" | "PHONE" | "EMAIL">(),
    } satisfies CandidateAccumulator);

  for (const reason of input.matchedBy) {
    current.matchedBy.add(reason);
  }

  for (const field of getConflictingFields(
    customer,
    input.quote,
    input.email,
  )) {
    current.conflictingFields.add(field);
  }

  candidatesById.set(customerId, current);
}

function toCustomerCandidate(
  accumulator: CandidateAccumulator,
): QuoteCustomerCandidate {
  const matchedBy = orderReasons(Array.from(accumulator.matchedBy));

  return {
    customerId: accumulator.customer.id.toString(),
    name: accumulator.customer.fullName,
    phone: accumulator.customer.phone?.toString() ?? null,
    email: accumulator.customer.email?.toString() ?? null,
    cpfCnpj: accumulator.customer.cpfCnpj?.toString() ?? null,
    matchedBy,
    conflictingFields: orderConflictingFields(
      Array.from(accumulator.conflictingFields),
    ),
    advisoryOnly: matchedBy.length === 1 && matchedBy[0] === "NAME",
  };
}

function getEvidenceReasons(
  customer: Customer,
  evidence: {
    phone?: string;
    email?: string;
    fullName?: string;
  },
): CustomerMatchReason[] {
  const reasons: CustomerMatchReason[] = [];

  if (evidence.phone && customer.phone?.toString() === evidence.phone) {
    reasons.push("PHONE");
  }

  if (
    evidence.email &&
    customer.email?.toString().toLowerCase() === evidence.email.toLowerCase()
  ) {
    reasons.push("EMAIL");
  }

  if (
    evidence.fullName &&
    customer.fullName.toLowerCase() === evidence.fullName.toLowerCase()
  ) {
    reasons.push("NAME");
  }

  return reasons;
}

function buildEvidence(input: {
  phone: string | undefined;
  email: string | undefined;
  fullName: string | undefined;
}) {
  const evidence: {
    phone?: string;
    email?: string;
    fullName?: string;
  } = {};

  if (input.phone) {
    evidence.phone = input.phone;
  }

  if (input.email) {
    evidence.email = input.email;
  }

  if (input.fullName) {
    evidence.fullName = input.fullName;
  }

  return evidence;
}

function getConflictingFields(
  customer: Customer,
  quote: Quote,
  email?: string,
): Array<"NAME" | "PHONE" | "EMAIL"> {
  const conflicts: Array<"NAME" | "PHONE" | "EMAIL"> = [];
  const quoteName = normalizeQuoteApprovalText(quote.customer.name);

  if (
    quoteName &&
    customer.fullName.toLowerCase() !== quoteName.toLowerCase()
  ) {
    conflicts.push("NAME");
  }

  const quotePhone = normalizeQuoteApprovalPhone(quote.customer.phone);

  if (quotePhone && customer.phone?.toString() !== quotePhone) {
    conflicts.push("PHONE");
  }

  if (
    email &&
    customer.email?.toString().toLowerCase() !== email.toLowerCase()
  ) {
    conflicts.push("EMAIL");
  }

  return conflicts;
}

function orderReasons(reasons: CustomerMatchReason[]) {
  const order: CustomerMatchReason[] = ["CPF_CNPJ", "PHONE", "EMAIL", "NAME"];

  return order.filter((reason) => reasons.includes(reason));
}

function orderConflictingFields(fields: Array<"NAME" | "PHONE" | "EMAIL">) {
  const order: Array<"NAME" | "PHONE" | "EMAIL"> = ["NAME", "PHONE", "EMAIL"];

  return order.filter((field) => fields.includes(field));
}
