// ...existing code...
import { Types } from "mongoose";
import { EmployerProfile } from "../models/EmployerProfile";
import Company from "../../../company/models/Company";
// import { Company } from "../models/Company";
// DTO import removed because 'dto/index.ts' is not exporting a module; use 'any' for DTO parameters below

export const createEmployerProfile = async (data: any) => {
  try {
    console.log("📝 Service: createEmployerProfile payload:", data);

    if (!data.company) throw new Error("company is required");

    // Resolve company -> accept companyId (ObjectId string), company ObjectId, or company name
    let companyId: Types.ObjectId;
    if (typeof data.company === "string") {
      if (Types.ObjectId.isValid(data.company)) {
        companyId = new Types.ObjectId(data.company);
      } else {
        // treat string as company name: find or create
        let comp = await Company.findOne({ name: data.company }).exec();
        if (!comp) {
          comp = await Company.create({ name: data.company });
        }
        companyId = comp._id as Types.ObjectId;
      }
    } else if ((data.company as any)?._id && Types.ObjectId.isValid((data.company as any)._id)) {
      companyId = new Types.ObjectId((data.company as any)._id);
    } else {
      // assume it's already an ObjectId-like value
      companyId = data.company as Types.ObjectId;
    }

    // convert user to ObjectId if needed
    if (data.user && typeof data.user === "string" && Types.ObjectId.isValid(data.user)) {
      (data as any).user = new Types.ObjectId(data.user);
    }

    const payload = { ...data, company: companyId };
    const created = await EmployerProfile.create(payload as any);
    return created.toObject ? created.toObject() : created;
  } catch (err: any) {
    console.error("❌ Service Error (createEmployerProfile):", err.message || err);
    throw err;
  }
};

export const getEmployerProfile = async (userIdOrProfileId: string) => {
  try {
    console.log("📝 Service: getEmployerProfile for id:", userIdOrProfileId);
    if (!userIdOrProfileId) return null;

    if (Types.ObjectId.isValid(userIdOrProfileId)) {
      const oid = new Types.ObjectId(userIdOrProfileId);
      const byUser = await EmployerProfile.findOne({ user: oid }).populate("company").lean().exec();
      if (byUser) return byUser;
      const byId = await EmployerProfile.findById(oid).populate("company").lean().exec();
      if (byId) return byId;
      return null;
    }

    const byUserString = await EmployerProfile.findOne({ user: userIdOrProfileId }).populate("company").lean().exec();
    return byUserString;
  } catch (err: any) {
    console.error("❌ Service Error (getEmployerProfile):", err.message || err);
    throw err;
  }
};

export const updateEmployerProfile = async (userIdOrProfileId: string, data: any) => {
  try {
    console.log("📝 Service: updateEmployerProfile id:", userIdOrProfileId, "data:", data);
    if (!userIdOrProfileId) return null;

    // If company provided, resolve it like in create
    if ((data as any).company && typeof (data as any).company === "string" && !Types.ObjectId.isValid((data as any).company)) {
      let comp = await Company.findOne({ name: (data as any).company }).exec();
      if (!comp) comp = await Company.create({ name: (data as any).company });
      (data as any).company = comp._id;
    }

    if (Types.ObjectId.isValid(userIdOrProfileId)) {
      const oid = new Types.ObjectId(userIdOrProfileId);
      const updatedByUser = await EmployerProfile.findOneAndUpdate({ user: oid }, data, { new: true, runValidators: true }).populate("company").lean().exec();
      if (updatedByUser) return updatedByUser;
      const updatedById = await EmployerProfile.findByIdAndUpdate(oid, data, { new: true, runValidators: true }).populate("company").lean().exec();
      if (updatedById) return updatedById;
      return null;
    }

    const updatedFallback = await EmployerProfile.findOneAndUpdate({ user: userIdOrProfileId }, data, { new: true, runValidators: true }).populate("company").lean().exec();
    return updatedFallback;
  } catch (err: any) {
    console.error("❌ Service Error (updateEmployerProfile):", err.message || err);
    throw err;
  }
};

export default { createEmployerProfile, getEmployerProfile, updateEmployerProfile };
// ...existing code...