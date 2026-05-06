import { Company, ICompany } from "../models/Company";
import { CompanyReview } from "../models/CompanyReview";
import { Job } from "../../job/models/Job";
import { Types } from "mongoose";

export const createCompany = async (data: ICompany) => {
  const normalizedName = String(data.name || "").trim();
  const normalizedEmail = data.email ? String(data.email).trim().toLowerCase() : "";
  const ownerId = data.owner ? String(data.owner) : "";

  if (!normalizedName || !normalizedEmail) {
    throw new Error("Company name and email are required");
  }

  if (ownerId) {
    const existingByOwner = await Company.findOne({ owner: ownerId }).select("_id").lean().exec();
    if (existingByOwner) {
      throw new Error("Recruiter already has a company");
    }
  }

  const existing = await Company.findOne({
    $or: [
      { name: { $regex: `^${normalizedName}$`, $options: "i" } },
      { email: normalizedEmail }
    ]
  });
  if (existing) throw new Error("Company already exists with same name or email");

  const company = await Company.create({
    ...data,
    name: normalizedName,
    email: normalizedEmail,
    ...(ownerId ? { owner: ownerId } : {}),
  });
  return company;
};

export const getAllCompanies = async () => {
  return await Company.find().lean().exec();
};

export const getPendingCompanies = async () => {
  return await Company.find({ isVerified: { $ne: true } }).sort({ createdAt: -1 }).lean().exec();
};

export const getCompanyById = async (id: string) => {
  const company = await Company.findById(id).lean().exec();
  if (!company) throw new Error("Company not found");
  return company;
};

export const updateCompany = async (id: string, data: Partial<ICompany>) => {
  const normalizedName = data.name ? String(data.name).trim() : undefined;
  const normalizedEmail = data.email ? String(data.email).trim().toLowerCase() : undefined;

  if (normalizedEmail) {
    const existingByEmail = await Company.findOne({ email: normalizedEmail, _id: { $ne: id } });
    if (existingByEmail) {
      throw new Error("Another company already uses this email");
    }
  }

  if (normalizedName) {
    const existingByName = await Company.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" },
      _id: { $ne: id }
    });
    if (existingByName) {
      throw new Error("Another company already uses this name");
    }
  }

  if (data.owner !== undefined) {
    throw new Error("Company owner cannot be changed");
  }

  const updated = await Company.findByIdAndUpdate(id, data, { new: true });
  if (!updated) throw new Error("Company not found");
  return updated;
};

export const deleteCompany = async (id: string) => {
  const deleted = await Company.findByIdAndDelete(id);
  if (!deleted) throw new Error("Company not found");
  return deleted;
};

export const getCompanyProfile = async (
  id: string,
  options?: { reviewsLimit?: number; page?: number; limit?: number; jobsLimit?: number },
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error("Invalid company id");
  }

  const companyObjectId = new Types.ObjectId(id);
  const reviewsLimit = Math.max(1, Math.min(50, Number(options?.reviewsLimit || 10)));
  const limit = Math.max(1, Math.min(50, Number(options?.limit || options?.jobsLimit || 10)));
  const page = Math.max(1, Number(options?.page || 1));
  const skip = (page - 1) * limit;

  const company = await Company.findById(companyObjectId).lean().exec();
  if (!company) {
    throw new Error("Company not found");
  }

  const [ratingAgg, reviews, openPositions, totalOpenPositions] = await Promise.all([
    CompanyReview.aggregate([
      { $match: { company: companyObjectId, isVisible: true } },
      {
        $group: {
          _id: "$company",
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 },
        },
      },
    ]),
    CompanyReview.find({ company: companyObjectId, isVisible: true })
      .select("rating review user createdAt")
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(reviewsLimit)
      .lean()
      .exec(),
    Job.find({ company: companyObjectId, status: "approved", isApproved: true })
      .select("title location jobType experienceLevel salary salaryMin salaryMax deadline vacancies createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Job.countDocuments({ company: companyObjectId, status: "approved", isApproved: true }),
  ]);

  const ratingSummary = ratingAgg[0]
    ? {
        averageRating: Number((ratingAgg[0].averageRating || 0).toFixed(1)),
        totalRatings: ratingAgg[0].totalRatings || 0,
      }
    : {
        averageRating: 0,
        totalRatings: 0,
      };

  return {
    overview: company,
    ratingSummary,
    reviews,
    openPositions: {
      total: totalOpenPositions,
      page,
      limit,
      totalPages: Math.ceil(totalOpenPositions / limit),
      jobs: openPositions,
    },
  };
};

export const createCompanyReview = async (
  companyId: string,
  userId: string,
  payload: { rating: number; review?: string },
) => {
  if (!Types.ObjectId.isValid(companyId)) {
    throw new Error("Invalid company id");
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user id");
  }

  const rating = Number(payload.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const company = await Company.findById(companyId).select("_id").lean().exec();
  if (!company) {
    throw new Error("Company not found");
  }

  const existingReview = await CompanyReview.findOne({ company: companyId, user: userId })
    .select("_id")
    .lean()
    .exec();

  if (existingReview) {
    throw new Error("Review already exists. Use update endpoint.");
  }

  return CompanyReview.create({
    company: companyId,
    user: userId,
    rating,
    review: payload.review?.trim() || undefined,
    isVisible: true,
  });
};

export const updateCompanyReview = async (
  companyId: string,
  userId: string,
  payload: { rating?: number; review?: string },
) => {
  if (!Types.ObjectId.isValid(companyId)) {
    throw new Error("Invalid company id");
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user id");
  }

  const updateData: Record<string, unknown> = {};

  if (payload.rating !== undefined) {
    const rating = Number(payload.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    updateData.rating = rating;
  }

  if (payload.review !== undefined) {
    updateData.review = payload.review?.trim() || "";
  }

  if (!Object.keys(updateData).length) {
    throw new Error("No update data provided");
  }

  const updated = await CompanyReview.findOneAndUpdate(
    { company: companyId, user: userId },
    updateData,
    { new: true },
  );

  if (!updated) {
    throw new Error("Review not found");
  }

  return updated;
};

export const deleteCompanyReview = async (companyId: string, userId: string) => {
  if (!Types.ObjectId.isValid(companyId)) {
    throw new Error("Invalid company id");
  }

  if (!Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user id");
  }

  const deleted = await CompanyReview.findOneAndDelete({
    company: companyId,
    user: userId,
  });

  if (!deleted) {
    throw new Error("Review not found");
  }

  return deleted;
};

export const moderateCompanyReview = async (
  companyId: string,
  reviewId: string,
  adminId: string,
  payload: { isVisible: boolean },
) => {
  if (!Types.ObjectId.isValid(companyId)) {
    throw new Error("Invalid company id");
  }

  if (!Types.ObjectId.isValid(reviewId)) {
    throw new Error("Invalid review id");
  }

  if (!Types.ObjectId.isValid(adminId)) {
    throw new Error("Invalid admin id");
  }

  if (typeof payload.isVisible !== "boolean") {
    throw new Error("isVisible must be boolean");
  }

  const updated = await CompanyReview.findOneAndUpdate(
    { _id: reviewId, company: companyId },
    {
      isVisible: payload.isVisible,
      moderatedAt: new Date(),
      moderatedBy: adminId,
    },
    { new: true },
  );

  if (!updated) {
    throw new Error("Review not found");
  }

  return updated;
};
