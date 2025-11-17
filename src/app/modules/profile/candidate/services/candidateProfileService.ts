

// export default { createCandidateProfile, getCandidateProfile, updateCandidateProfile };
import { Types } from "mongoose";
import { CandidateProfile } from "../models/CandidateProfile";

export const createCandidateProfile = async (data: any) => {
  try {
    console.log("📝 Service: Creating profile with data:", data);
    if (data.user && typeof data.user === "string" && Types.ObjectId.isValid(data.user)) {
      data.user = new Types.ObjectId(data.user);
    }
    const doc = await CandidateProfile.create(data);
    console.log("✅ Service: Profile created:", doc._id);
    return doc.toObject ? doc.toObject() : doc;
  } catch (err: any) {
    console.error("❌ Service Error (create):", err.message || err);
    throw err;
  }
};

export const getCandidateProfile = async (userIdOrProfileId: string) => {
  try {
    console.log("📝 Service: Getting profile for id:", userIdOrProfileId);
    if (!userIdOrProfileId) return null;

    // validate ObjectId
    if (Types.ObjectId.isValid(userIdOrProfileId)) {
      const oid = new Types.ObjectId(userIdOrProfileId);

      // try by user reference
      const byUser = await CandidateProfile.findOne({ user: oid })
        .populate("resume")
        .populate({ path: "user", select: "-password -__v" })
        .lean()
        .exec();
      if (byUser) {
        console.log("✅ Service: Profile found by user ref:", byUser._id);
        return byUser;
      }

      // fallback: maybe caller passed profile._id
      const byId = await CandidateProfile.findById(oid)
        .populate("resume")
        .populate({ path: "user", select: "-password -__v" })
        .lean()
        .exec();
      if (byId) {
        console.log("✅ Service: Profile found by profile _id:", byId._id);
        return byId;
      }

      console.log("⚠️ Service: Profile not found for id:", userIdOrProfileId);
      return null;
    }

    // non-objectid fallback: try string user field
    const byUserString = await CandidateProfile.findOne({ user: userIdOrProfileId })
      .populate("resume")
      .populate({ path: "user", select: "-password -__v" })
      .lean()
      .exec();
    if (byUserString) {
      console.log("✅ Service: Profile found by user string:", byUserString._id);
      return byUserString;
    }

    console.log("⚠️ Service: Profile not found for id (non-oid):", userIdOrProfileId);
    return null;
  } catch (err: any) {
    console.error("❌ Service Error (get):", err.message || err);
    throw err;
  }
};

export const updateCandidateProfile = async (userIdOrProfileId: string, data: any) => {
  try {
    console.log("📝 Service: Updating profile for id:", userIdOrProfileId);
    if (!userIdOrProfileId) return null;

    if (data.user && typeof data.user === "string" && Types.ObjectId.isValid(data.user)) {
      data.user = new Types.ObjectId(data.user);
    }

    if (Types.ObjectId.isValid(userIdOrProfileId)) {
      const oid = new Types.ObjectId(userIdOrProfileId);

      const updatedByUser = await CandidateProfile.findOneAndUpdate(
        { user: oid },
        data,
        { new: true, runValidators: true }
      )
        .populate("resume")
        .populate({ path: "user", select: "-password -__v" })
        .lean()
        .exec();
      if (updatedByUser) {
        console.log("✅ Service: Updated by user ref:", updatedByUser._id);
        return updatedByUser;
      }

      const updatedById = await CandidateProfile.findByIdAndUpdate(oid, data, {
        new: true,
        runValidators: true,
      })
        .populate("resume")
        .populate({ path: "user", select: "-password -__v" })
        .lean()
        .exec();
      if (updatedById) {
        console.log("✅ Service: Updated by profile id:", updatedById._id);
        return updatedById;
      }

      console.log("⚠️ Service: No profile found to update for id:", userIdOrProfileId);
      return null;
    }

    // non-objectid fallback
    const updatedFallback = await CandidateProfile.findOneAndUpdate(
      { user: userIdOrProfileId },
      data,
      { new: true, runValidators: true }
    )
      .populate("resume")
      .populate({ path: "user", select: "-password -__v" })
      .lean()
      .exec();

    if (updatedFallback) {
      console.log("✅ Service: Updated (fallback):", updatedFallback._id);
      return updatedFallback;
    }

    console.log("⚠️ Service: No profile found to update (non-oid):", userIdOrProfileId);
    return null;
  } catch (err: any) {
    console.error("❌ Service Error (update):", err.message || err);
    throw err;
  }
};

export default { createCandidateProfile, getCandidateProfile, updateCandidateProfile };