type BuildPasswordResetEmailInput = {
  resetPath: string;
  token: string;
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
}: BuildPasswordResetEmailInput): PasswordResetEmailContent {
  const resetUrl = buildResetUrl(resetPath, token);

  return {
    subject: "Redefinição de senha",
    html: `
      <p>Você solicitou a redefinição da sua senha.</p>
      <p><a href="${resetUrl}">Clique aqui para redefinir sua senha</a></p>
      <p>Se você não fez essa solicitação, ignore este e-mail.</p>
      <p>Este link expira em breve.</p>
    `.trim(),
    text: [
      "Você solicitou a redefinição da sua senha.",
      `Acesse o link para redefinir: ${resetUrl}`,
      "Se você não fez essa solicitação, ignore este e-mail.",
      "Este link expira em breve.",
    ].join("\n"),
  };
}
