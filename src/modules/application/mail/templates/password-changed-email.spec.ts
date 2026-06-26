import { buildPasswordChangedEmail } from "./password-changed-email";

describe("buildPasswordChangedEmail", () => {
  it("should include login url in subject, html and text", () => {
    const email = buildPasswordChangedEmail({
      loginUrl: "https://app.example.com/login",
    });

    expect(email.subject).toBe("Sua senha foi alterada");
    expect(email.html).toContain("https://app.example.com/login");
    expect(email.text).toContain("https://app.example.com/login");
    expect(email.html).toContain("Sua senha foi alterada com sucesso.");
  });
});
