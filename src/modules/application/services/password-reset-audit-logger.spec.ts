import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { PasswordResetAuditLogger } from "./password-reset-audit-logger";

describe("PasswordResetAuditLogger", () => {
  it("should log structured payload without sensitive data", () => {
    const logger = new PasswordResetAuditLogger();
    const logSpy = vi
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);

    logger.log({
      event: "password_reset.completed",
      outcome: "success",
      userId: "user-id",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: "password_reset.completed",
        outcome: "success",
        userId: "user-id",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      }),
    );

    logSpy.mockRestore();
  });
});
