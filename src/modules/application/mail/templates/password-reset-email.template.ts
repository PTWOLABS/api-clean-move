import { renderEmailLayout } from "./shared/email-layout.template";

type RenderPasswordResetEmailTemplateInput = {
  resetUrl: string;
  logoUrl: string;
  expiresInMinutes: number;
};

export function renderPasswordResetEmailTemplate({
  resetUrl,
  logoUrl,
  expiresInMinutes,
}: RenderPasswordResetEmailTemplateInput): string {
  const bodyHtml = `<div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
        Redefinição de senha
      </div>

      <div style="font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.25;margin-bottom:12px;">
        Olá,
      </div>

      <div style="font-size:16px;color:#475569;line-height:1.65;margin-bottom:32px;">
        Recebemos uma solicitação para redefinir a senha da sua conta.
        Clique no botão abaixo para criar uma nova senha com segurança.
      </div>

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

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:14px;color:#64748b;line-height:1.6;margin-bottom:8px;">
              Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá a mesma.
            </div>
            <div style="font-size:14px;color:#334155;line-height:1.6;">
              Este link expira em <strong style="color:#0f172a;">${expiresInMinutes} minutos</strong>.
            </div>
          </td>
        </tr>
      </table>

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
      </div>`;

  return renderEmailLayout({
    logoUrl,
    preheader: `Redefina a senha da sua conta Clean Move. O link expira em ${expiresInMinutes} minutos.`,
    pageTitle: "Redefinição de Senha",
    bodyHtml,
  });
}
