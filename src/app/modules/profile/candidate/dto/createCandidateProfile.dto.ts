export interface CreateCandidateProfileDTO {
  user: string;
  name: string;
  phone: string;
  address?: string;
  skills?: string[];
}
