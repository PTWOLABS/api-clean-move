import { renderPasswordResetEmailTemplate } from "./password-reset-email.template";

type BuildPasswordResetEmailInput = {
  resetPath: string;
  token: string;
  logoUrl: string;
};

type PasswordResetEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function buildResetUrl(resetPath: string, token: string): string {
  const url = new URL(resetPath);
  url.searchParams.set("token", token);

  return url.toString();
}

export function buildPasswordResetEmail({
  resetPath,
  token,
  logoUrl,
}: BuildPasswordResetEmailInput): PasswordResetEmailContent {
  const resetUrl = buildResetUrl(resetPath, token);

  return {
    subject: "Redefinição de senha",
    html: renderPasswordResetEmailTemplate({ resetUrl, logoUrl }),
    text: [
      "Redefinição de senha — Clean Move",
      "",
      "Olá,",
      "",
      "Recebemos uma solicitação para redefinir a senha da sua conta.",
      "Clique no link abaixo para criar uma nova senha com segurança:",
      "",
      resetUrl,
      "",
      "Se você não solicitou esta alteração, ignore este e-mail.",
      "Sua senha permanecerá a mesma.",
      "Este link expira em 15 minutos.",
      "",
      "Segurança: nunca compartilhe este link.",
      "Nossa equipe nunca solicitará sua senha.",
      "",
      "Atenciosamente,",
      "Equipe Clean Move",
    ].join("\n"),
  };
}
