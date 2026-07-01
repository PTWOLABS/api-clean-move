import { buildPasswordChangeConfirmationEmail } from "./password-change-confirmation-email";

describe("buildPasswordChangeConfirmationEmail", () => {
  it("should include the confirmation code and expiration in all formats", () => {
    const email = buildPasswordChangeConfirmationEmail({
      confirmationCode: "123456",
      logoUrl: "https://cdn.example.com/logo.png",
      expiresInMinutes: 15,
    });

    expect(email.subject).toBe("Confirme a alteração de senha");
    expect(email.html).toContain('data-confirmation-code="123456"');
    expect(email.html).toContain("123456");
    expect(email.html).toContain("15 minutos");
    expect(email.text).toContain("123456");
    expect(email.text).toContain("15 minutos");
  });
});
