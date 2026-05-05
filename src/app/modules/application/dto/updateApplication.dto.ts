export interface UpdateApplicationDTO {
  status?: "Applied" | "Reviewed" | "Shortlisted" | "Interview" | "Rejected" | "Accepted";
  interviewScheduledAt?: string;
  resume?: string;
  coverLetter?: string;
}
