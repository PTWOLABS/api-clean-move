import { buildPasswordResetEmail } from "./password-reset-email";

const logoUrl = "https://cdn.example.com/brand/logo.png";

describe("buildPasswordResetEmail", () => {
  it("should include reset link with token in subject, html and text", () => {
    const email = buildPasswordResetEmail({
      resetPath: "https://app.example.com/reset-password",
      token: "plain-reset-token",
      logoUrl,
    });

    const resetUrl =
      "https://app.example.com/reset-password?token=plain-reset-token";

    expect(email.subject).toBe("Redefinição de senha");
    expect(email.html).toContain(`href="${resetUrl}"`);
    expect(email.html).toContain(`src="${logoUrl}"`);
    expect(email.html).toContain("Clean Move");
    expect(email.html).toContain("Redefinir minha senha");
    expect(email.html).toContain("15 minutos");
    expect(email.text).toContain(resetUrl);
    expect(email.text).toContain("15 minutos");
    expect(email.text).toContain("Equipe Clean Move");
  });

  it("should preserve existing query params in reset path", () => {
    const email = buildPasswordResetEmail({
      resetPath: "https://app.example.com/reset-password?lang=pt",
      token: "plain-reset-token",
      logoUrl,
    });

    expect(email.html).toContain(
      "https://app.example.com/reset-password?lang=pt&token=plain-reset-token",
    );
  });
});
