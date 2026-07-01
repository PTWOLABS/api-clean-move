import { buildWelcomeEmail } from "./welcome-email";

const logoUrl = "https://cdn.example.com/brand/logo.png";

describe("buildWelcomeEmail", () => {
  it("should include personalized greeting, login url and branding", () => {
    const email = buildWelcomeEmail({
      userName: "Maria Silva",
      loginUrl: "https://app.example.com/login",
      logoUrl,
    });

    expect(email.subject).toBe("Bem-vindo(a) à Clean Move");
    expect(email.html).toContain(`href="https://app.example.com/login"`);
    expect(email.html).toContain(`src="${logoUrl}"`);
    expect(email.html).toContain("Olá, Maria");
    expect(email.html).toContain("Boas-vindas");
    expect(email.html).toContain("Acessar minha conta");
    expect(email.text).toContain("Olá, Maria");
    expect(email.text).toContain("https://app.example.com/login");
    expect(email.text).toContain("Equipe Clean Move");
  });

  it("should fallback to full name when first name is unavailable", () => {
    const email = buildWelcomeEmail({
      userName: "   ",
      loginUrl: "https://app.example.com/login",
      logoUrl,
    });

    expect(email.html).toContain("Olá, usuário");
    expect(email.text).toContain("Olá, usuário");
  });

  it("should escape html in the user name", () => {
    const email = buildWelcomeEmail({
      userName: "<script>alert(1)</script> Silva",
      loginUrl: "https://app.example.com/login",
      logoUrl,
    });

    expect(email.html).toContain("Olá, &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>");
  });
});
