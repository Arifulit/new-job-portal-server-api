interface VerificationEmailParams {
  name: string;
  verificationUrl: string;
  supportEmail: string;
}

export const getVerificationEmail = ({
  name,
  verificationUrl,
  supportEmail
}: VerificationEmailParams) => ({
  subject: 'Verify Your Email Address',
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Welcome to Our Platform!</h1>
      </div>
      
      <div style="padding: 20px;">
        <p>Hello ${name},</p>
        
        <p>Thank you for signing up! To complete your registration, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #4f46e5; 
                    color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Verify Email Address
          </a>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        
        <p>This link will expire in 24 hours for security reasons.</p>
        
        <p>If you didn't create an account, you can safely ignore this email.</p>
        
        <p>Best regards,<br>The Team</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="font-size: 12px; color: #6b7280;">
          If you're having trouble with the button above, copy and paste the URL below into your web browser.<br>
          <span style="word-break: break-all;">${verificationUrl}</span>
        </p>
        
        <p style="font-size: 12px; color: #6b7280;">
          If you have any questions, please contact our support team at 
          <a href="mailto:${supportEmail}" style="color: #4f46e5;">${supportEmail}</a>.
        </p>
      </div>
    </div>
  `,
  text: `Welcome to Our Platform!

Hello ${name},

Thank you for signing up! To complete your registration, please verify your email address by visiting the following link:

${verificationUrl}

This link will expire in 24 hours for security reasons.

If you didn't create an account, you can safely ignore this email.

Best regards,
The Team

---
If you're having trouble with the link above, copy and paste the URL below into your web browser:
${verificationUrl}

If you have any questions, please contact our support team at ${supportEmail}.
`
});
