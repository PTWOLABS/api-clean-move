type BuildPasswordChangedEmailInput = {
  loginUrl: string;
};

type PasswordChangedEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function buildPasswordChangedEmail({
  loginUrl,
}: BuildPasswordChangedEmailInput): PasswordChangedEmailContent {
  return {
    subject: "Sua senha foi alterada",
    html: `
      <p>Sua senha foi alterada com sucesso.</p>
      <p>Se você não realizou essa alteração, entre em contato com o suporte imediatamente.</p>
      <p><a href="${loginUrl}">Acessar o login</a></p>
    `.trim(),
    text: [
      "Sua senha foi alterada com sucesso.",
      "Se você não realizou essa alteração, entre em contato com o suporte imediatamente.",
      `Acesse o login: ${loginUrl}`,
    ].join("\n"),
  };
}
