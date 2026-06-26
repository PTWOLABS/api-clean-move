import {
  PasswordResetAuditContext,
  PasswordResetAuditEvent,
  PasswordResetAuditLogger,
  PasswordResetAuditOutcome,
} from "../../src/modules/application/services/password-reset-audit-logger";

export class FakePasswordResetAuditLogger extends PasswordResetAuditLogger {
  public readonly entries: Array<{
    event: PasswordResetAuditEvent;
    outcome: PasswordResetAuditOutcome;
    userId?: string;
    reason?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }> = [];

  override log(
    input: {
      event: PasswordResetAuditEvent;
      outcome: PasswordResetAuditOutcome;
      userId?: string;
      reason?: string;
    } & PasswordResetAuditContext,
  ): void {
    this.entries.push(input);
  }

  clear(): void {
    this.entries.length = 0;
  }
}
