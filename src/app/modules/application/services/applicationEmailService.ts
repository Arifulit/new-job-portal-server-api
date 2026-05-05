import { sendEmail } from "../../../utils/mailer";

type ApplicationSubmittedEmailInput = {
  to: string;
  candidateName?: string;
  jobTitle?: string;
};

type ApplicationStatusEmailInput = {
  to: string;
  candidateName?: string;
  status: "Applied" | "Reviewed" | "Shortlisted" | "Interview" | "Rejected" | "Accepted";
  jobTitle?: string;
  interviewScheduledAt?: string;
};

const formatCandidateName = (name?: string) => (name?.trim() ? name : "Candidate");
const formatJobTitle = (title?: string) => (title?.trim() ? title : "the selected position");

const formatInterviewSchedule = (value?: string) => {
  if (!value?.trim()) {
    return "";
  }

  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) {
    return value;
  }

  const [year, month, day] = datePart.split("-");
  const [hourRaw, minuteRaw] = timePart.split(":");
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);
  const hourNumber = Number(hourRaw);
  const minuteNumber = minuteRaw || "00";

  if (!year || !month || !day || Number.isNaN(monthIndex) || Number.isNaN(dayNumber) || Number.isNaN(hourNumber)) {
    return value;
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const period = hourNumber >= 12 ? "PM" : "AM";
  const displayHour = hourNumber % 12 === 0 ? 12 : hourNumber % 12;
  const monthName = monthNames[monthIndex] || month;

  return `${monthName} ${dayNumber}, ${year} at ${displayHour}:${minuteNumber} ${period}`;
};

export const sendApplicationSubmittedEmail = async ({
  to,
  candidateName,
  jobTitle,
}: ApplicationSubmittedEmailInput): Promise<void> => {
  const safeCandidateName = formatCandidateName(candidateName);
  const safeJobTitle = formatJobTitle(jobTitle);

  const subject = "Your application has been submitted";
  const text = `Hello ${safeCandidateName},\n\nYour application for ${safeJobTitle} has been submitted successfully.\n\nThank you.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <h2>Application Submitted</h2>
      <p>Hello ${safeCandidateName},</p>
      <p>Your application for <strong>${safeJobTitle}</strong> has been submitted successfully.</p>
      <p>Thank you.</p>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
};

export const sendApplicationStatusUpdatedEmail = async ({
  to,
  candidateName,
  status,
  jobTitle,
  interviewScheduledAt,
}: ApplicationStatusEmailInput): Promise<void> => {
  const safeCandidateName = formatCandidateName(candidateName);
  const safeJobTitle = formatJobTitle(jobTitle);
  const scheduleLabel = formatInterviewSchedule(interviewScheduledAt);

  let subject = `Your application was ${status.toLowerCase()}`;
  let text = `Hello ${safeCandidateName},\n\nYour application for ${safeJobTitle} was ${status.toLowerCase()}.\n\nThank you.`;
  let html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <h2>Application Status Updated</h2>
      <p>Hello ${safeCandidateName},</p>
      <p>Your application for <strong>${safeJobTitle}</strong> was <strong>${status.toLowerCase()}</strong>.</p>
      <p>Thank you.</p>
    </div>
  `;

  if (status === "Interview" && scheduleLabel) {
    subject = `Your interview has been scheduled`;
    text = `Hello ${safeCandidateName},\n\nYour interview for ${safeJobTitle} has been scheduled for ${scheduleLabel}.\n\nThank you.`;
    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 640px; margin: 0 auto;">
        <h2>Interview Scheduled</h2>
        <p>Hello ${safeCandidateName},</p>
        <p>Your interview for <strong>${safeJobTitle}</strong> has been scheduled for <strong>${scheduleLabel}</strong>.</p>
        <p>Thank you.</p>
      </div>
    `;
  }

  await sendEmail({ to, subject, text, html });
};
