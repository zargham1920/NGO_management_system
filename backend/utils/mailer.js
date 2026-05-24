const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials are not configured. Email not sent.');
    console.log({ to, subject, text, html });
    return false;
  }

  const message = {
    from: process.env.EMAIL_FROM || 'Umeed-e-Sahar <no-reply@umeedrdms.org>',
    to,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(message);
    return true;
  } catch (error) {
    console.error('Mailer sendMail error:', error);
    return false;
  }
}

module.exports = {
  sendMail,
};
