type RenderEmailLayoutInput = {
  logoUrl: string;
  preheader: string;
  pageTitle: string;
  bodyHtml: string;
};

const fontFamily =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function renderEmailLayout({
  logoUrl,
  preheader,
  pageTitle,
  bodyHtml,
}: RenderEmailLayoutInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
</head>

<body style="margin:0;padding:0;background:#f0f4fa;font-family:${fontFamily};-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
  ${preheader}
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
      ${bodyHtml}
    </td>
  </tr>

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
