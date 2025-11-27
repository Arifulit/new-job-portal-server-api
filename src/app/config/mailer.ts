import nodemailer from "nodemailer";
import { env } from "./env";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export const sendMail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
  });
};

export const sendVerificationEmail = async ({ name, email, verificationToken }: { 
  name: string; 
  email: string; 
  verificationToken: string 
}) => {
  const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${verificationToken}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Email Verification</h2>
      <p>Hello ${name},</p>
      <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
      <div style="margin: 30px 0;">
        <a href="${verificationUrl}" 
           style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 4px; font-weight: bold;">
          Verify Email Address
        </a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p>${verificationUrl}</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>Best regards,<br>Your Application Team</p>
    </div>
  `;

  await sendMail(email, 'Verify Your Email Address', html);
};
