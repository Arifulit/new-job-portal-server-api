import nodemailer from "nodemailer";
import { getVerificationEmail } from "../templates/verificationEmail";

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  // For development with self-signed certificates
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Verify connection configuration
transporter.verify(function (error) {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Server is ready to take our messages');
  }
});

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
  from = process.env.SMTP_FROM || 'noreply@yourdomain.com'
}: MailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME || 'Your App'}" <${from}>`,
      to,
      subject,
      text,
      html
    });
    
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
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
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
  const { subject, html, text } = getVerificationEmail({
    name,
    verificationUrl,
    supportEmail: process.env.SUPPORT_EMAIL || 'support@yourdomain.com'
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
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  
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
