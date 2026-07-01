import { renderEmailLayout } from "./shared/email-layout.template";

type RenderPasswordChangeConfirmationEmailTemplateInput = {
  confirmationCode: string;
  logoUrl: string;
  expiresInMinutes: number;
};

export function renderPasswordChangeConfirmationEmailTemplate({
  confirmationCode,
  logoUrl,
  expiresInMinutes,
}: RenderPasswordChangeConfirmationEmailTemplateInput): string {
  const bodyHtml = `<div style="font-size:20px;font-weight:700;color:#0f172a;margin-bottom:12px;line-height:1.3;">
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
      </div>`;

  return renderEmailLayout({
    logoUrl,
    preheader: `Use o código ${confirmationCode} para confirmar a alteração de senha da sua conta Clean Move.`,
    pageTitle: "Confirmação de alteração de senha",
    bodyHtml,
  });
}
