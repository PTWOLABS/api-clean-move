type RenderPasswordResetEmailTemplateInput = {
  resetUrl: string;
  logoUrl: string;
};

const fontFamily =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderPasswordResetEmailTemplate({
  resetUrl,
  logoUrl,
}: RenderPasswordResetEmailTemplateInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Redefinição de Senha</title>
</head>

<body style="margin:0;padding:0;background:#f0f4fa;font-family:${fontFamily};-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  Redefina a senha da sua conta Clean Move. O link expira em 15 minutos.
</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4fa;padding:32px 16px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <tr>
    <td style="background:linear-gradient(135deg,#0047d6 0%,#2563eb 100%);padding:32px 40px;">

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="left" valign="middle">
            <img src="${logoUrl}"
                 height="40"
                 alt="Clean Move"
                 style="display:block;height:40px;width:auto;margin-bottom:16px;border:0;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;line-height:1.2;">
              Clean Move
            </div>
            <div style="font-size:14px;color:rgba(255,255,255,0.82);margin-top:6px;line-height:1.4;">
              Soluções que movem o futuro.
            </div>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <!-- BODY -->
  <tr>
    <td style="padding:40px;">

      <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
        Redefinição de senha
      </div>

      <div style="font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.25;margin-bottom:12px;">
        Olá,
      </div>

      <div style="font-size:16px;color:#475569;line-height:1.65;margin-bottom:32px;">
        Recebemos uma solicitação para redefinir a senha da sua conta.
        Clique no botão abaixo para criar uma nova senha com segurança.
      </div>

      <!-- CTA -->
      <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px auto;">
        <tr>
          <td align="center" bgcolor="#2563eb" style="border-radius:10px;background:#2563eb;">
            <a href="${resetUrl}"
               style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">
              Redefinir minha senha
            </a>
          </td>
        </tr>
      </table>

      <!-- INFO -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:8px;">
              Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá a mesma.
            </div>
            <div style="font-size:14px;color:#334155;line-height:1.6;">
              Este link expira em <strong style="color:#0f172a;">15 minutos</strong>.
            </div>
          </td>
        </tr>
      </table>

      <!-- SEGURANÇA -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fbff;border-radius:12px;border:1px solid #dbeafe;border-left:4px solid #2563eb;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:15px;font-weight:600;color:#1e3a8a;margin-bottom:6px;">
              Segurança em primeiro lugar
            </div>
            <div style="font-size:14px;color:#475569;line-height:1.6;">
              Nunca compartilhe este link. Nossa equipe nunca solicitará sua senha.
            </div>
          </td>
        </tr>
      </table>

      <div style="margin-top:32px;font-size:14px;color:#64748b;line-height:1.6;">
        Atenciosamente,<br>
        <strong style="color:#2563eb;font-size:15px;font-weight:600;">Equipe Clean Move</strong>
      </div>

    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td align="center" style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
      <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
        &copy; 2026 Clean Move &middot; Todos os direitos reservados.
      </div>
    </td>
  </tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
}
