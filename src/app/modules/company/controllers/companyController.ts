import { Request, Response } from "express";
import * as companyService from "../services/companyService";

export const createCompany = async (req: Request, res: Response) => {
  try {
    const company = await companyService.createCompany(req.body);
    res.status(201).json({ success: true, data: company });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await companyService.getAllCompanies();
    res.status(200).json({ success: true, data: companies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCompany = async (req: Request, res: Response) => {
  try {
    const company = await companyService.getCompanyById(req.params.id);
    res.status(200).json({ success: true, data: company });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const updateCompany = async (req: Request, res: Response) => {
  try {
    const company = await companyService.updateCompany(req.params.id, req.body);
    res.status(200).json({ success: true, data: company });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const deleteCompany = async (req: Request, res: Response) => {
  try {
    await companyService.deleteCompany(req.params.id);
    res.status(200).json({ success: true, message: "Company deleted" });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};
