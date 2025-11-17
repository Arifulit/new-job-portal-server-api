import { Company, ICompany } from "../models/Company";

export const createCompany = async (data: ICompany) => {
  const existing = await Company.findOne({ name: data.name });
  if (existing) throw new Error("Company already exists");

  const company = await Company.create(data);
  return company;
};

export const getAllCompanies = async () => {
  return await Company.find().lean().exec();
};

export const getCompanyById = async (id: string) => {
  const company = await Company.findById(id).lean().exec();
  if (!company) throw new Error("Company not found");
  return company;
};

export const updateCompany = async (id: string, data: Partial<ICompany>) => {
  const updated = await Company.findByIdAndUpdate(id, data, { new: true });
  if (!updated) throw new Error("Company not found");
  return updated;
};

export const deleteCompany = async (id: string) => {
  const deleted = await Company.findByIdAndDelete(id);
  if (!deleted) throw new Error("Company not found");
  return deleted;
};
