import { buildPasswordResetEmail } from "./password-reset-email";

describe("buildPasswordResetEmail", () => {
  it("should include reset link with token in subject, html and text", () => {
    const email = buildPasswordResetEmail({
      resetPath: "https://app.example.com/reset-password",
      token: "plain-reset-token",
    });

    expect(email.subject).toBe("Redefinição de senha");
    expect(email.html).toContain(
      "https://app.example.com/reset-password?token=plain-reset-token",
    );
    expect(email.text).toContain(
      "https://app.example.com/reset-password?token=plain-reset-token",
    );
  });

  it("should preserve existing query params in reset path", () => {
    const email = buildPasswordResetEmail({
      resetPath: "https://app.example.com/reset-password?lang=pt",
      token: "plain-reset-token",
    });

    expect(email.html).toContain(
      "https://app.example.com/reset-password?lang=pt&token=plain-reset-token",
    );
  });
});
