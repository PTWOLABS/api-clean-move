type RenderPasswordChangeConfirmationEmailTemplateInput = {
  confirmationCode: string;
  logoUrl: string;
  expiresInMinutes: number;
};

const fontFamily =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderPasswordChangeConfirmationEmailTemplate({
  confirmationCode,
  logoUrl,
  expiresInMinutes,
}: RenderPasswordChangeConfirmationEmailTemplateInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmação de alteração de senha</title>
</head>

<body style="margin:0;padding:0;background:#f0f4fa;font-family:${fontFamily};-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  Use o código ${confirmationCode} para confirmar a alteração de senha da sua conta Clean Move.
</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4fa;padding:32px 16px;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

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

  <tr>
    <td style="padding:40px;">
      <div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:12px;line-height:1.3;">
        Confirme a alteração de senha
      </div>
      <div style="font-size:15px;color:#475569;line-height:1.6;margin-bottom:28px;">
        Olá,<br><br>
        Recebemos uma solicitação para alterar a senha da sua conta.
        Use o código abaixo para confirmar a operação:
      </div>

      <div data-confirmation-code="${confirmationCode}"
           style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
        <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
          Código de confirmação
        </div>
        <div style="font-size:36px;font-weight:700;color:#0047d6;letter-spacing:0.3em;font-family:monospace;">
          ${confirmationCode}
        </div>
      </div>

      <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:24px;">
        Este código expira em <strong>${expiresInMinutes} minutos</strong>.
        Se você não solicitou essa alteração, ignore este e-mail e mantenha sua senha atual.
      </div>

      <div style="font-size:13px;color:#94a3b8;line-height:1.5;border-top:1px solid #f1f5f9;padding-top:20px;">
        Nossa equipe nunca solicitará sua senha por e-mail ou telefone.
      </div>
    </td>
  </tr>

  <tr>
    <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
      <div style="font-size:12px;color:#94a3b8;line-height:1.5;text-align:center;">
        © Clean Move. Todos os direitos reservados.
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
