import { renderWelcomeEmailTemplate } from "./welcome-email.template";

type BuildWelcomeEmailInput = {
  userName: string;
  loginUrl: string;
  logoUrl: string;
};

type WelcomeEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function getFirstName(userName: string): string {
  const firstName = userName.trim().split(/\s+/)[0];

  return firstName || userName.trim() || "usuário";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildWelcomeEmail({
  userName,
  loginUrl,
  logoUrl,
}: BuildWelcomeEmailInput): WelcomeEmailContent {
  const firstName = escapeHtml(getFirstName(userName));

  return {
    subject: "Bem-vindo(a) à Clean Move",
    html: renderWelcomeEmailTemplate({ firstName, loginUrl, logoUrl }),
    text: [
      "Boas-vindas — Clean Move",
      "",
      `Olá, ${getFirstName(userName)}`,
      "",
      "É um prazer ter você conosco. Sua conta foi criada com sucesso.",
      "",
      `Acessar minha conta: ${loginUrl}`,
      "",
      "Próximos passos:",
      "1. Acesse sua conta com o e-mail cadastrado.",
      "2. Complete seu perfil para uma experiência personalizada.",
      "3. Explore os serviços disponíveis na plataforma.",
      "",
      "Nunca compartilhe sua senha. Nossa equipe nunca solicitará credenciais.",
      "",
      "Atenciosamente,",
      "Equipe Clean Move",
    ].join("\n"),
  };
}
