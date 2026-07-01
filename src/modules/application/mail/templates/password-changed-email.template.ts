import { renderEmailLayout } from "./shared/email-layout.template";

type RenderPasswordChangedEmailTemplateInput = {
  loginUrl: string;
  logoUrl: string;
};

export function renderPasswordChangedEmailTemplate({
  loginUrl,
  logoUrl,
}: RenderPasswordChangedEmailTemplateInput): string {
  const bodyHtml = `<div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
        Senha alterada
      </div>

      <div style="font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.25;margin-bottom:12px;">
        Olá,
      </div>

      <div style="font-size:16px;color:#475569;line-height:1.65;margin-bottom:32px;">
        Sua senha foi alterada com sucesso. Você já pode acessar sua conta
        com a nova senha.
      </div>

      <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px auto;">
        <tr>
          <td align="center" bgcolor="#2563eb" style="border-radius:10px;background:#2563eb;">
            <a href="${loginUrl}"
               style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">
              Acessar minha conta
            </a>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;border-left:4px solid #d97706;margin-bottom:28px;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:15px;font-weight:600;color:#92400e;margin-bottom:6px;">
              Não reconhece esta alteração?
            </div>
            <div style="font-size:14px;color:#78350f;line-height:1.6;">
              Se você não realizou essa alteração, entre em contato com o suporte
              imediatamente para proteger sua conta.
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
              Nossa equipe nunca solicitará sua senha por e-mail ou telefone.
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
    preheader: "A senha da sua conta Clean Move foi alterada com sucesso.",
    pageTitle: "Senha alterada",
    bodyHtml,
  });
}
