import nodemailer from "nodemailer";
import { getVerificationEmail } from "../templates/verificationEmail";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const isPlaceholderValue = (value?: string) =>
  !value ||
  value.includes("your_") ||
  value.includes("example.com") ||
  value.includes("app_password");

const isSmtpConfigured =
  !isPlaceholderValue(smtpHost) &&
  !isPlaceholderValue(smtpUser) &&
  !isPlaceholderValue(smtpPass);

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  // If SMTP_SECURE is not set, infer from port. Port 465 requires secure=true.
  secure: process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  // For development with self-signed certificates
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "production"
  }
});

// Verify connection configuration
if (isSmtpConfigured) {
  transporter.verify((error) => {
    if (error) {
      console.error("Error connecting to email server:", error);
    } else {
      console.log("Email server is ready to take messages");
    }
  });
} else {
  console.warn(
    "SMTP is not fully configured. Email sending is disabled until SMTP_HOST/SMTP_USER/SMTP_PASS are set."
  );
}

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

/**
 * Send an email
 */
export const sendEmail = async ({ 
  to, 
  subject, 
  text, 
  html,
  from = process.env.SMTP_FROM || "noreply@yourdomain.com"
}: MailOptions) => {
  if (!isSmtpConfigured) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS with valid values."
    );
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Your App'}" <${from}>`,
      to,
      subject,
      text,
      html
    });
    
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

interface SendVerificationEmailParams {
  name: string;
  email: string;
  verificationToken: string;
}

/**
 * Send a verification email to a user
 */
export const sendVerificationEmail = async ({
  name,
  email,
  verificationToken
}: SendVerificationEmailParams) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const { subject, html, text } = getVerificationEmail({
    name,
    verificationUrl,
    supportEmail: process.env.SUPPORT_EMAIL || 'ariful.iit@gmail.com'
  });

  return sendEmail({
    to: email,
    subject,
    text,
    html
  });
};

/**
 * Send a password reset email
 */
export const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
      `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset Your Password</h2>
        <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
        <p>Please click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 4px;">
          Reset Password
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      </div>
    `
  });
};
