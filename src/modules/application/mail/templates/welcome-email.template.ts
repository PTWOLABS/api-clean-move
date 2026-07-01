import { renderEmailLayout } from "./shared/email-layout.template";

type RenderWelcomeEmailTemplateInput = {
  firstName: string;
  loginUrl: string;
  logoUrl: string;
};

export function renderWelcomeEmailTemplate({
  firstName,
  loginUrl,
  logoUrl,
}: RenderWelcomeEmailTemplateInput): string {
  const bodyHtml = `<div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:20px;">
        Boas-vindas
      </div>

      <div style="font-size:26px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;line-height:1.25;margin-bottom:12px;">
        Olá, ${firstName}
      </div>

      <div style="font-size:16px;color:#475569;line-height:1.65;margin-bottom:32px;">
        É um prazer ter você conosco. Sua conta foi criada com sucesso e você
        já pode aproveitar tudo o que a Clean Move oferece.
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

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px;">
        <tr>
          <td style="padding:18px 20px;">
            <div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:10px;">
              Próximos passos
            </div>
            <div style="font-size:14px;color:#475569;line-height:1.7;">
              1. Acesse sua conta com o e-mail cadastrado.<br>
              2. Complete seu perfil para uma experiência personalizada.<br>
              3. Explore os serviços disponíveis na plataforma.
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
              Nunca compartilhe sua senha. Nossa equipe nunca solicitará
              credenciais por e-mail ou telefone.
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
    preheader: `Bem-vindo(a) à Clean Move, ${firstName}. Sua conta foi criada com sucesso.`,
    pageTitle: "Bem-vindo à Clean Move",
    bodyHtml,
  });
}
