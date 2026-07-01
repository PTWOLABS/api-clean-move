import { renderPasswordChangedEmailTemplate } from "./password-changed-email.template";

type BuildPasswordChangedEmailInput = {
  loginUrl: string;
  logoUrl: string;
};

type PasswordChangedEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function buildPasswordChangedEmail({
  loginUrl,
  logoUrl,
}: BuildPasswordChangedEmailInput): PasswordChangedEmailContent {
  return {
    subject: "Sua senha foi alterada",
    html: renderPasswordChangedEmailTemplate({ loginUrl, logoUrl }),
    text: [
      "Senha alterada — Clean Move",
      "",
      "Olá,",
      "",
      "Sua senha foi alterada com sucesso. Você já pode acessar sua conta com a nova senha.",
      "",
      `Acessar minha conta: ${loginUrl}`,
      "",
      "Se você não realizou essa alteração, entre em contato com o suporte imediatamente.",
      "",
      "Nossa equipe nunca solicitará sua senha por e-mail ou telefone.",
      "",
      "Atenciosamente,",
      "Equipe Clean Move",
    ].join("\n"),
  };
}
