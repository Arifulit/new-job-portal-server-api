import { Request, Response } from "express";
import { CandidateProfile } from "../../profile/candidate/models/CandidateProfile";
import { Company } from "../../company/models/Company";
import { Job } from "../../job/models/Job";
import { Application } from "../../application/models/Application";
import { CompanyReview } from "../../company/models/CompanyReview";

export const getSummaryStats = async (_req: Request, res: Response) => {
  try {
    const checkModel = (m: any, name: string) => {
      if (!m || typeof m.countDocuments !== "function") {
        throw new Error(`Model '${name}' is not available or not initialized`);
      }
    };

    // Defensive checks to surface which model is missing
    checkModel(CandidateProfile, "CandidateProfile");
    checkModel(Company, "Company");
    checkModel(Job, "Job");
    checkModel(Application, "Application");
    if (!CompanyReview || typeof CompanyReview.aggregate !== "function") {
      throw new Error(`Model 'CompanyReview' is not available or not initialized`);
    }
    const [
      activeCandidates,
      activeEmployers,
      openJobs,
      totalApplications,
      successfulPlacements,
      employerSatisfactionAgg
    ] = await Promise.all([
      CandidateProfile.countDocuments(),
      Company.countDocuments(),
      Job.countDocuments({ status: "approved" }),
      Application.countDocuments(),
      Application.countDocuments({ status: "Accepted" }),
      CompanyReview.aggregate([
        { $match: { isVisible: true } },
        { $group: { _id: null, avg: { $avg: "$rating" } } }
      ])
    ]);

    const employerSatisfaction = employerSatisfactionAgg[0]?.avg
      ? Math.round(employerSatisfactionAgg[0].avg * 20)
      : 97; // fallback to 97%

    res.json({
      success: true,
      data: {
        activeCandidates,
        successfulPlacements,
        employerSatisfaction,
        activeEmployers,
        openJobs,
        totalApplications
      },
      display: {
        activeCandidates: activeCandidates >= 1000 ? `${Math.floor(activeCandidates / 1000)}K+` : `${activeCandidates}`,
        successfulPlacements: successfulPlacements >= 1000 ? `${Math.floor(successfulPlacements / 1000)}K+` : `${successfulPlacements}`,
        employerSatisfaction: `${employerSatisfaction}%`,
        activeEmployers: activeEmployers >= 1000 ? `${Math.floor(activeEmployers / 1000)}K+` : `${activeEmployers}`,
        openJobs: openJobs >= 1000 ? `${Math.floor(openJobs / 1000)}K+` : `${openJobs}`,
        totalApplications: totalApplications >= 1000 ? `${Math.floor(totalApplications / 1000)}K+` : `${totalApplications}`
      }
    });
  } catch (err) {
    console.error("[SUMMARY_STATS_ERROR]", err);
    res.status(500).json({ success: false, message: "Failed to fetch stats", error: err?.message || err });
  }
};
