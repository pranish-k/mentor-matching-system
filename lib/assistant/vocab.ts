// Fixed vocabularies. Every filterable mentor attribute takes values from one
// of these lists, so filters and counts are exact ("Banking & Capital Markets"
// is always spelled one way). Changing a list means re-running enrichment.

// The site's own focus taxonomy, taken verbatim from mentors.json.
export const FOCUS_AREAS = [
  "C-Level Management",
  "Digital & Business Transformation",
  "Cybersecurity",
  "New Business Ventures",
  "Data Management & Analytics",
  "Media & Entertainment Technology Management",
] as const;

export const INDUSTRIES = [
  "Banking & Capital Markets",
  "Investment & Asset Management",
  "Venture Capital & Private Equity",
  "Insurance",
  "Fintech & Payments",
  "Consulting & Professional Services",
  "Software & Internet",
  "IT Services & Hardware",
  "Telecommunications",
  "Healthcare & Life Sciences",
  "Media, Entertainment & Advertising",
  "Consumer Goods & Retail",
  "Manufacturing & Industrials",
  "Energy & Utilities",
  "Transportation & Logistics",
  "Real Estate & Construction",
  "Government & Public Sector",
  "Defense & Aerospace",
  "Education",
  "Non-Profit & Social Impact",
  "Legal",
  "Executive Search & Coaching",
  "Hospitality & Travel",
] as const;

export const EXPERTISE = [
  "AI & Machine Learning",
  "Cybersecurity",
  "Data & Analytics",
  "Cloud & Infrastructure",
  "Enterprise Architecture",
  "Software Engineering",
  "Product Management",
  "Digital Transformation",
  "IT Strategy & Operations",
  "Innovation & R&D",
  "Entrepreneurship & Startups",
  "Fundraising & Venture Capital",
  "Board Governance",
  "Mergers & Acquisitions",
  "Corporate Strategy",
  "Marketing & Brand",
  "Sales & Business Development",
  "Customer Experience",
  "Operations & Supply Chain",
  "Finance & Accounting",
  "Risk & Compliance",
  "Privacy & Regulation",
  "HR & Talent",
  "Leadership Development & Coaching",
  "Change Management",
  "Blockchain & Digital Assets",
  "Healthcare IT",
  "Sustainability & ESG",
  "Public Policy",
  "Global Business",
  "Diversity & Inclusion",
  "Teaching & Research",
  "Media & Content",
] as const;

// Highest level the mentor has reached, current or former.
export const SENIORITY = ["C-Suite", "VP", "Director", "Professional", "Academic"] as const;

// Roles a mentor holds or has held, alongside their main job.
export const ROLES = [
  "Founder",
  "Board Member",
  "Investor",
  "Advisor",
  "Professor",
  "Author",
  "Executive Coach",
  "Public Servant",
] as const;

export const REGIONS = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa",
] as const;

const COUNTRY_REGION: Record<string, Region> = {
  "United States": "North America",
  Canada: "North America",
  Mexico: "Latin America",
  Chile: "Latin America",
  Brazil: "Latin America",
  Argentina: "Latin America",
  Colombia: "Latin America",
  Peru: "Latin America",
  "United Kingdom": "Europe",
  Ireland: "Europe",
  France: "Europe",
  Germany: "Europe",
  Switzerland: "Europe",
  Austria: "Europe",
  Portugal: "Europe",
  Spain: "Europe",
  Italy: "Europe",
  Netherlands: "Europe",
  Belgium: "Europe",
  Hungary: "Europe",
  Sweden: "Europe",
  Denmark: "Europe",
  Norway: "Europe",
  Finland: "Europe",
  Poland: "Europe",
  India: "Asia-Pacific",
  China: "Asia-Pacific",
  Singapore: "Asia-Pacific",
  "South Korea": "Asia-Pacific",
  Japan: "Asia-Pacific",
  Australia: "Asia-Pacific",
  "New Zealand": "Asia-Pacific",
  "Hong Kong": "Asia-Pacific",
  Egypt: "Middle East & Africa",
  Nigeria: "Middle East & Africa",
  "South Africa": "Middle East & Africa",
  Kenya: "Middle East & Africa",
  Israel: "Middle East & Africa",
  "United Arab Emirates": "Middle East & Africa",
  "Saudi Arabia": "Middle East & Africa",
};

export type FocusArea = (typeof FOCUS_AREAS)[number];
export type Industry = (typeof INDUSTRIES)[number];
export type Expertise = (typeof EXPERTISE)[number];
export type Seniority = (typeof SENIORITY)[number];
export type Role = (typeof ROLES)[number];
export type Region = (typeof REGIONS)[number];

// Returns null for a country we have no mapping for, so the sync script can
// fail loudly instead of silently dropping a mentor from region filters.
export function regionForCountry(country: string): Region | null {
  return COUNTRY_REGION[country] ?? null;
}
