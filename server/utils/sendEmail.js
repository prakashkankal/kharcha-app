import nodemailer from 'nodemailer';

/**
 * Sends an email using Nodemailer or logs to console as fallback
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: { user, pass },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Kharcha Expense Tracker" <${user}>`,
        to,
        subject,
        text,
        html,
      });

      console.log(`Email sent to ${to}: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error(`Failed to send email to ${to}:`, err.message);
    }
  }

  // Development Fallback: Log email details to console
  console.log('\n=================== EMAIL SENDER (DEV MODE) ===================');
  console.log(`TO: ${to}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`TEXT: ${text}`);
  console.log('===============================================================\n');
  return true;
};
