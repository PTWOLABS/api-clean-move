import { buildPasswordChangedEmail } from "./password-changed-email";

const logoUrl = "https://cdn.example.com/brand/logo.png";

describe("buildPasswordChangedEmail", () => {
  it("should include login url in subject, html and text", () => {
    const email = buildPasswordChangedEmail({
      loginUrl: "https://app.example.com/login",
      logoUrl,
    });

    expect(email.subject).toBe("Sua senha foi alterada");
    expect(email.html).toContain(`href="https://app.example.com/login"`);
    expect(email.html).toContain(`src="${logoUrl}"`);
    expect(email.html).toContain("Clean Move");
    expect(email.html).toContain("Sua senha foi alterada com sucesso");
    expect(email.html).toContain("Acessar minha conta");
    expect(email.html).toContain("Não reconhece esta alteração?");
    expect(email.text).toContain("https://app.example.com/login");
    expect(email.text).toContain("Equipe Clean Move");
  });
});
