import type { Expertise, FocusArea, Industry, Region, Role, Seniority } from "./vocab";

// A published mentor as synced from new-center, with HTML entities decoded and
// location / focus parsed. Every field here is already public on the site.
export type SourceMentor = {
  slug: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  linkedin: string;
  image: string; // file name, served from `${MENTOR_IMAGE_BASE}/mentors/<image>`
  location: string;
  city: string;
  state: string; // US state / province code when given, else ""
  country: string;
  region: Region;
  focusAreas: FocusArea[];
  siteIndustries: string[]; // the site's original (coarse) industry tags
};

// What the enrichment step adds, produced by Claude from the source record.
export type MentorProfile = {
  summary: string;
  industries: Industry[];
  expertise: Expertise[];
  seniority: Seniority;
  roles: Role[];
  organizations: string[];
  canHelpWith: string[];
};

export type Mentor = SourceMentor & MentorProfile;

// One page of the live site, as crawled by the sync script.
export type SitePage = {
  path: string;
  title: string;
  text: string;
};
