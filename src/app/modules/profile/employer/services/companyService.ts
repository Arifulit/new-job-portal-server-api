// import { Company } from "../models/Company";

import Company from "../../../company/models/Company";

export const createCompany = async (data: any) => {
  return await Company.create(data);
};

export const getCompanyById = async (id: string) => {
  return await Company.findById(id);
};
