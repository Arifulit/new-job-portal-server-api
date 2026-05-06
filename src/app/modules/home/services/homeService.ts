import { Types } from "mongoose";
import { Job } from "../../job/models/Job";
import Company from "../../company/models/Company";
import CareerResource from "../../careerResources/models/CareerResource";

type HomeCompanyItem = {
  _id: string;
  name: string;
  logo?: string;
  industry?: string;
  location?: string;
  roleCount: number;
};

type HomeJobItem = {
  _id: string;
  title: string;
  location?: string;
  jobType?: string;
  salary?: number;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  deadline?: Date;
  vacancies?: number;
  createdAt?: Date;
  company?: { _id?: string; name?: string; logo?: string; industry?: string } | string | null;
};

const normalizeCompanyName = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name.trim() : "";
  }

  return "";
};

const toHomeJobItem = (job: any): HomeJobItem => ({
  _id: String(job._id),
  title: String(job.title || "Untitled Job"),
  location: typeof job.location === "string" ? job.location : undefined,
  jobType: typeof job.jobType === "string" ? job.jobType : undefined,
  salary: typeof job.salary === "number" ? job.salary : undefined,
  salaryMin: typeof job.salaryMin === "number" ? job.salaryMin : undefined,
  salaryMax: typeof job.salaryMax === "number" ? job.salaryMax : undefined,
  currency: typeof job.currency === "string" ? job.currency : undefined,
  deadline: job.deadline ? new Date(job.deadline) : undefined,
  vacancies: typeof job.vacancies === "number" ? job.vacancies : undefined,
  createdAt: job.createdAt ? new Date(job.createdAt) : undefined,
  company: job.company
    ? typeof job.company === "string"
      ? job.company
      : {
          _id: String(job.company._id || ""),
          name: typeof job.company.name === "string" ? job.company.name : undefined,
          logo: typeof job.company.logo === "string" ? job.company.logo : undefined,
          industry: typeof job.company.industry === "string" ? job.company.industry : undefined,
        }
    : null,
});

const formatJobTypeLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const buildResourceLabel = (resource: { tag?: string; category?: string }) => {
  return resource.tag || resource.category || "Career";
};

export const getHomePageData = async () => {
  const featuredLimit = 6;
  const resourcesLimit = 3;
  const companiesLimit = 8;

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const [featuredJobs, totalJobs, totalVacanciesAgg, recentJobs, categoryAgg, companyAgg, companyDocs, resources] = await Promise.all([
    Job.find({ status: "approved", isApproved: true })
      .sort({ createdAt: -1 })
      .limit(featuredLimit)
      .populate("company", "name logo industry location")
      .lean()
      .exec(),
    Job.countDocuments({ status: "approved", isApproved: true }),
    Job.aggregate([
      { $match: { status: "approved", isApproved: true } },
      {
        $group: {
          _id: null,
          totalVacancies: { $sum: { $ifNull: ["$vacancies", 0] } },
        },
      },
    ]),
    Job.countDocuments({ status: "approved", isApproved: true, createdAt: { $gte: currentMonthStart } }),
    Job.aggregate([
      { $match: { status: "approved", isApproved: true } },
      {
        $group: {
          _id: { $toLower: "$jobType" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),
    Job.aggregate([
      { $match: { status: "approved", isApproved: true, company: { $ne: null } } },
      {
        $group: {
          _id: "$company",
          roleCount: { $sum: 1 },
        },
      },
      { $sort: { roleCount: -1, _id: 1 } },
      { $limit: companiesLimit },
    ]),
    Company.find().sort({ isVerified: -1, createdAt: -1 }).limit(companiesLimit).lean().exec(),
    CareerResource.find().sort({ createdAt: -1 }).limit(resourcesLimit).lean().exec(),
  ]);

  const totalVacancies = totalVacanciesAgg[0]?.totalVacancies || 0;

  const companyMap = new Map<string, HomeCompanyItem>();

  companyDocs.forEach((company: any) => {
    const id = String(company._id || company.id || "");
    if (!id) return;

    companyMap.set(id, {
      _id: id,
      name: String(company.name || "Unnamed Company"),
      logo: typeof company.logo === "string" ? company.logo : undefined,
      industry: typeof company.industry === "string" ? company.industry : undefined,
      location: typeof company.location === "string" ? company.location : undefined,
      roleCount: 0,
    });
  });

  companyAgg.forEach((row: any) => {
    const id = String(row._id || "");
    if (!id) return;

    if (!companyMap.has(id)) {
      companyMap.set(id, {
        _id: id,
        name: "Company",
        roleCount: 0,
      });
    }

    const existing = companyMap.get(id)!;
    existing.roleCount = Number(row.roleCount || 0);
  });

  const companyIds = companyAgg
    .map((row: any) => String(row._id || ""))
    .filter(Boolean);

  if (companyIds.length > 0) {
    const companies = await Company.find({ _id: { $in: companyIds.map((id) => new Types.ObjectId(id)) } })
      .select("name logo industry location")
      .lean()
      .exec();

    companies.forEach((company: any) => {
      const id = String(company._id || company.id || "");
      const existing = companyMap.get(id);
      if (!existing) return;

      existing.name = String(company.name || existing.name);
      existing.logo = typeof company.logo === "string" ? company.logo : existing.logo;
      existing.industry = typeof company.industry === "string" ? company.industry : existing.industry;
      existing.location = typeof company.location === "string" ? company.location : existing.location;
    });
  }

  const topCompanies = Array.from(companyMap.values())
    .sort((a, b) => b.roleCount - a.roleCount || a.name.localeCompare(b.name))
    .slice(0, companiesLimit);

  const categories = categoryAgg.map((item: any) => ({
    key: String(item._id || "full-time"),
    label: formatJobTypeLabel(String(item._id || "full-time")),
    count: Number(item.count || 0),
    description:
      String(item._id || "").toLowerCase() === "remote"
        ? "Flexible and location-independent roles"
        : String(item._id || "").toLowerCase() === "internship"
          ? "Entry points for students and freshers"
          : String(item._id || "").toLowerCase() === "contract"
            ? "Project-based and short-term work"
            : "Open opportunities from verified employers",
  }));

  const mappedResources = resources.map((resource: any) => ({
    _id: String(resource._id),
    title: String(resource.title || "Career Resource"),
    description: String(resource.description || ""),
    tag: buildResourceLabel(resource),
  }));

  return {
    stats: {
      totalJobs,
      totalVacancies,
      totalCompanies: companyMap.size,
      recentJobs,
    },
    featuredJobs: featuredJobs.map(toHomeJobItem),
    categories,
    topCompanies,
    careerResources: mappedResources,
  };
};