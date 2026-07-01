import { renderPasswordChangeConfirmationEmailTemplate } from "./password-change-confirmation-email.template";

type BuildPasswordChangeConfirmationEmailInput = {
  confirmationCode: string;
  logoUrl: string;
  expiresInMinutes?: number;
};

type PasswordChangeConfirmationEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function buildPasswordChangeConfirmationEmail({
  confirmationCode,
  logoUrl,
  expiresInMinutes = 15,
}: BuildPasswordChangeConfirmationEmailInput): PasswordChangeConfirmationEmailContent {
  return {
    subject: "Confirme a alteração de senha",
    html: renderPasswordChangeConfirmationEmailTemplate({
      confirmationCode,
      logoUrl,
      expiresInMinutes,
    }),
    text: [
      "Confirmação de alteração de senha — Clean Move",
      "",
      "Olá,",
      "",
      "Recebemos uma solicitação para alterar a senha da sua conta.",
      "Use o código abaixo para confirmar a operação:",
      "",
      confirmationCode,
      "",
      `Este código expira em ${expiresInMinutes} minutos.`,
      "",
      "Se você não solicitou essa alteração, ignore este e-mail e mantenha sua senha atual.",
      "",
      "Nossa equipe nunca solicitará sua senha por e-mail ou telefone.",
      "",
      "Atenciosamente,",
      "Equipe Clean Move",
    ].join("\n"),
  };
}
