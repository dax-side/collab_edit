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
      subject: `${inviterEmail} invited you to collaborate — CollabEdit`,
      text: `
COLLABEDIT

You've been invited to collaborate

${inviterEmail} invited you to work on a document together.

Open CollabEdit: ${APP_URL}

If you don't have an account yet, sign up first.

—
CollabEdit
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f1e8; font-family: system-ui, -apple-system, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f1e8; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #fff; border: 2px solid #111;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px; border-bottom: 2px solid #111;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 36px; height: 36px; background-color: #111; text-align: center; vertical-align: middle;">
                    <span style="color: #f5f1e8; font-size: 12px; font-weight: bold;">CE</span>
                  </td>
                  <td style="padding-left: 12px; font-weight: bold; font-size: 18px; color: #111;">CollabEdit</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: bold; color: #111;">You've been invited</h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333;">
                <strong>${inviterEmail}</strong> invited you to collaborate on a document.
              </p>
              <a href="${APP_URL}" style="display: inline-block; padding: 14px 28px; background-color: #f4d03f; color: #111; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; text-decoration: none; border: 0;">
                Open CollabEdit
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; border-top: 2px solid #111; background-color: #f5f1e8;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                Don't have an account? You'll need to sign up first.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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

export async function sendPasswordResetEmail(
  toEmail: string,
  resetToken: string,
): Promise<boolean> {
  try {
    const transport = await getTransporter();
    const appBaseUrl = (APP_URL ?? '').replace(/\/+$/, '');
    const resetUrl = `${appBaseUrl}/reset-password?token=${resetToken}`;

    const info = await transport.sendMail({
      from: EMAIL_FROM,
      to: toEmail,
      subject: 'Reset your password — CollabEdit',
      text: `
COLLABEDIT

Reset your password

Someone requested a password reset for this email. Click the link below to set a new password:

${resetUrl}

This link expires in 1 hour.

Didn't request this? Ignore this email.

—
CollabEdit
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f1e8; font-family: system-ui, -apple-system, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f1e8; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #fff; border: 2px solid #111;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px; border-bottom: 2px solid #111;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 36px; height: 36px; background-color: #111; text-align: center; vertical-align: middle;">
                    <span style="color: #f5f1e8; font-size: 12px; font-weight: bold;">CE</span>
                  </td>
                  <td style="padding-left: 12px; font-weight: bold; font-size: 18px; color: #111;">CollabEdit</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: bold; color: #111;">Reset your password</h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333;">
                Someone requested a password reset for this email. Click the button below to set a new password.
              </p>
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #f4d03f; color: #111; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; text-decoration: none; border: 0;">
                Reset Password
              </a>
              <p style="margin: 24px 0 0 0; font-size: 13px; color: #666;">
                This link expires in 1 hour.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; border-top: 2px solid #111; background-color: #f5f1e8;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                Didn't request this? You can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    logger.info(`Password reset email sent to ${toEmail}: ${info.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`Preview email: ${previewUrl}`);
    }

    return true;
  } catch (err) {
    logger.error('Failed to send password reset email:', err);
    return false;
  }
}
