const nodemailer = require("nodemailer");
const { env } = require("./env");

let transporter;

function getTransporter() {
  if (!env.smtpUser || !env.smtpPass) {
    const error = new Error("Email 2FA is not configured. Set SMTP_USER and SMTP_PASS in backend/.env.");
    error.statusCode = 500;
    throw error;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass
      }
    });
  }

  return transporter;
}

async function sendTwoFactorCode({ to, name, code }) {
  const safeName = name || "there";
  await getTransporter().sendMail({
    from: env.smtpFrom || env.smtpUser,
    to,
    subject: "Your EduClub sign-in code",
    text: `Hello ${safeName},\n\nYour EduClub verification code is ${code}. It expires in ${env.twoFactorCodeMinutes} minutes.\n\nIf you did not try to sign in, please ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#102a43">
        <p>Hello ${escapeHtml(safeName)},</p>
        <p>Your EduClub verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>This code expires in ${env.twoFactorCodeMinutes} minutes.</p>
        <p>If you did not try to sign in, please ignore this email.</p>
      </div>
    `
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

module.exports = { sendTwoFactorCode };
