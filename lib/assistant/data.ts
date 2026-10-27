// Loads the generated data files (see scripts/) into typed records. JSON is
// imported rather than read from disk so it is bundled with the server code.

import enrichedJson from "@/data/mentors.enriched.json";
import pagesJson from "@/data/pages.json";
import sourceJson from "@/data/mentors.source.json";
import type { Mentor, MentorProfile, SitePage, SourceMentor } from "./types";

type EnrichedFile = Record<string, { hash: string; profile: MentorProfile }>;

// Fails loudly if the two files drift apart (sync ran without enrich), so a
// mentor is never served without a profile.
export function joinMentors(source: SourceMentor[], enriched: EnrichedFile): Mentor[] {
  return source.map((m) => {
    const entry = enriched[m.slug];
    if (!entry) throw new Error(`No enriched profile for "${m.slug}". Run npm run data:enrich.`);
    return { ...m, ...entry.profile };
  });
}

let mentors: Mentor[] | null = null;

export function getMentors(): Mentor[] {
  mentors ??= joinMentors(sourceJson as SourceMentor[], enrichedJson as EnrichedFile);
  return mentors;
}

export function getPages(): SitePage[] {
  return pagesJson as SitePage[];
}
