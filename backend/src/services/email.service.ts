import nodemailer from 'nodemailer';
import { logger } from '../shared/utils/logger';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;
const APP_URL = process.env.APP_URL;

let transporter: nodemailer.Transporter | null = null;


async function getTransporter() {
  if (transporter) return transporter;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('No SMTP credentials found. Creating Ethereal test account for development...');
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    logger.info(`Ethereal test account created: ${testAccount.user}`);
    logger.info(`Preview emails at: https://ethereal.email/messages`);
  } else {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

export async function sendInviteEmail(
  toEmail: string,
  inviterEmail: string,
  documentId: string,
): Promise<boolean> {
  try {
    const transport = await getTransporter();

    const info = await transport.sendMail({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `${inviterEmail} invited you to collaborate on a document`,
      text: `
${inviterEmail} has invited you to collaborate on a document.

Click the link below to access the document:
${APP_URL}

If you don't have an account yet, you'll need to sign up first.

---
CollabEdit - Real-time collaborative editing
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #222; max-width: 100%; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #222; color: #fff; text-decoration: none; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>You've been invited to collaborate</h2>
    <p><strong>${inviterEmail}</strong> has invited you to collaborate on a document.</p>
    <a href="${APP_URL}" class="button">Open CollabEdit</a>
    <p>If you don't have an account yet, you'll need to sign up first.</p>
    <div class="footer">
      <p>CollabEdit - Real-time collaborative editing</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    });

    logger.info(`Invite email sent to ${toEmail}: ${info.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`Preview email: ${previewUrl}`);
    }

    return true;
  } catch (err) {
    logger.error('Failed to send invite email:', err);
    return false;
  }
}
