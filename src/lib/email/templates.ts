import "server-only";

export interface ReportShareEmailProps {
  to: string;
  from: string;
  companyName: string;
  poolName: string;
  reportUrl: string;
}

export function buildReportShareEmail(props: ReportShareEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: `Service Report — ${props.poolName}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="padding:32px 24px 8px">
<h1 style="margin:0;font-size:20px;font-weight:600;color:#111">Pool Service Report</h1>
<p style="margin:8px 0 0;font-size:14px;color:#666">${props.companyName} has completed a service visit for <strong>${props.poolName}</strong>.</p>
</td></tr>
<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background:#0d9488;border-radius:8px;padding:12px 24px">
<a href="${props.reportUrl}" style="display:inline-block;font-size:15px;font-weight:600;color:#fff;text-decoration:none">View Full Report →</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 24px 24px">
<p style="margin:0;font-size:13px;color:#999;line-height:1.5">Or copy this link into your browser:<br>
<a href="${props.reportUrl}" style="color:#0d9488;word-break:break-all">${props.reportUrl}</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee">
<p style="margin:0;font-size:12px;color:#999">Sent via Poolbench · Your trusted pool service platform</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  };
}

export interface InvitationEmailProps {
  to: string;
  from: string;
  companyName: string;
  inviteUrl: string;
}

export function buildInvitationEmail(props: InvitationEmailProps) {
  return {
    to: props.to,
    from: props.from,
    subject: `You've been invited to join ${props.companyName}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="padding:32px 24px 8px">
<h1 style="margin:0;font-size:20px;font-weight:600;color:#111">You're Invited!</h1>
<p style="margin:8px 0 0;font-size:14px;color:#666">You have been invited to join <strong>${props.companyName}</strong> on Poolbench — the platform for managing pool service visits, water readings, and reports.</p>
</td></tr>
<tr><td style="padding:16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="background:#0d9488;border-radius:8px;padding:12px 24px">
<a href="${props.inviteUrl}" style="display:inline-block;font-size:15px;font-weight:600;color:#fff;text-decoration:none">Accept Invitation →</a>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:0 24px 24px">
<p style="margin:0;font-size:13px;color:#999;line-height:1.5">Or copy this link into your browser:<br>
<a href="${props.inviteUrl}" style="color:#0d9488;word-break:break-all">${props.inviteUrl}</a></p>
</td></tr>
<tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee">
<p style="margin:0;font-size:12px;color:#999">Sent via Poolbench · Your trusted pool service platform</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  };
}
