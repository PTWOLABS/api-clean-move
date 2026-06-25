import { Injectable, Logger } from "@nestjs/common";

export type PasswordResetAuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type PasswordResetAuditEvent =
  | "password_reset.requested"
  | "password_reset.token_issued"
  | "password_reset.completed"
  | "password_reset.confirm_failed";

export type PasswordResetAuditOutcome = "success" | "failure" | "skipped";

type PasswordResetAuditLogInput = PasswordResetAuditContext & {
  event: PasswordResetAuditEvent;
  outcome: PasswordResetAuditOutcome;
  userId?: string;
  reason?: string;
};

@Injectable()
export class PasswordResetAuditLogger {
  private readonly logger = new Logger(PasswordResetAuditLogger.name);

  log(input: PasswordResetAuditLogInput): void {
    const payload = {
      event: input.event,
      outcome: input.outcome,
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
      ...(input.ipAddress !== undefined && input.ipAddress !== null
        ? { ipAddress: input.ipAddress }
        : {}),
      ...(input.userAgent !== undefined && input.userAgent !== null
        ? { userAgent: input.userAgent }
        : {}),
    };

    this.logger.log(JSON.stringify(payload));
  }
}
