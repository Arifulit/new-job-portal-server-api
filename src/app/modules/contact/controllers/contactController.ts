import { Request, Response } from "express";
import { sendEmail } from "../../../utils/mailer";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "ariful.iit@gmail.com";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const sendContactMessageController = async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required",
      });
    }

    const subjectLine = subject || `Contact form message from ${name}`;
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subjectLine);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Contact] ${subjectLine}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subjectLine}`,
        "",
        message,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px;">
          <h2 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">New Contact Message</h2>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
            <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeName}</p>
            <p style="margin: 0 0 8px;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color: #2563eb;">${safeEmail}</a></p>
            <p style="margin: 0 0 8px;"><strong>Subject:</strong> ${safeSubject}</p>
            <p style="margin: 16px 0 8px;"><strong>Message:</strong></p>
            <div style="white-space: normal; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; color: #334155;">${safeMessage}</div>
          </div>
          <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">Reply directly to this email thread to respond to the sender.</p>
        </div>
      `,
      from: SUPPORT_EMAIL,
      replyTo: email,
    });

    return res.status(200).json({
      success: true,
      message: "Your message has been sent successfully",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    return res.status(500).json({
      success: false,
      message,
    });
  }
};