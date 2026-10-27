// Pulls everything the assistant knows from the new-center site:
//   1. Published mentors from the site repo's mentors.json  -> data/mentors.source.json
//   2. Text of every public page on the deployed site      -> data/pages.json
//
// Usage: npm run data:sync   (reads NEW_CENTER_PATH and SITE_URL from .env.local)

import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { decodeEntities, parseFocusAreas, parseLocation, splitValues } from "../lib/assistant/parse";
import { regionForCountry } from "../lib/assistant/vocab";
import type { SitePage, SourceMentor } from "../lib/assistant/types";

process.loadEnvFile(".env.local");

const NEW_CENTER_PATH = requireEnv("NEW_CENTER_PATH");
const SITE_URL = (process.env.SITE_URL ?? "https://new-center-pi.vercel.app").replace(/\/$/, "");
const SITE_APP_DIR = path.join(NEW_CENTER_PATH, "proposed_center", "site", "app");
const MENTORS_JSON = path.join(NEW_CENTER_PATH, "proposed_center", "data", "mentors", "mentors.json");

// Pages that are not useful knowledge for the assistant: the mentor directory
// is covered by mentor data, and per-mentor pages are dynamic.
const SKIP_ROUTES = new Set(["/mentors"]);

type RawMentor = {
  slug: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  focus: string;
  location: string;
  linkedin: string;
  bio: string;
  image: string;
  published?: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  return value;
}

function syncMentors(): SourceMentor[] {
  const raw = JSON.parse(readFileSync(MENTORS_JSON, "utf-8")) as RawMentor[];
  const published = raw.filter((m) => m.published !== false);

  const mentors = published.map((m): SourceMentor => {
    const { city, state, country } = parseLocation(m.location);
    const region = regionForCountry(country);
    if (!region) {
      throw new Error(`No region mapping for country "${country}" (mentor ${m.slug}). Add it to lib/assistant/vocab.ts.`);
    }
    return {
      slug: m.slug,
      name: decodeEntities(m.name).trim(),
      title: decodeEntities(m.title).trim(),
      company: decodeEntities(m.company).trim(),
      bio: decodeEntities(m.bio).trim(),
      linkedin: m.linkedin,
      image: m.image.replace(/^images\//, ""),
      location: decodeEntities(m.location).trim(),
      city,
      state,
      country,
      region,
      focusAreas: parseFocusAreas(m.focus),
      siteIndustries: splitValues(m.industry),
    };
  });

  mentors.sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync("data/mentors.source.json", JSON.stringify(mentors, null, 2) + "\n");
  console.log(`mentors: ${mentors.length} published (${raw.length - published.length} unpublished skipped)`);
  return mentors;
}

// Static routes of the site, discovered from its app/ directory so new pages
// are picked up without editing this script.
function discoverRoutes(dir: string, prefix = ""): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("[") || entry.startsWith("(") || entry.startsWith("_")) continue;
      routes.push(...discoverRoutes(full, `${prefix}/${entry}`));
    } else if (entry === "page.tsx") {
      routes.push(prefix || "/");
    }
  }
  return routes;
}

// Turns a page's <main> into plain text with markdown-style headings and
// bullets, which keeps structure for the model at a fraction of HTML's size.
// Text nodes under a node, in document order, each trimmed.
function textPieces(node: AnyNode): string[] {
  if (node.type === "text") {
    const t = node.data.trim();
    return t ? [t] : [];
  }
  return "children" in node ? node.children.flatMap(textPieces) : [];
}

function extractText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $("title").text().replace(/\s*\|\s*Teachers College\s*$/, "").trim();
  const main = $("main");
  main.find("script, style, noscript, svg, img").remove();

  // The site builds many lists and cards from plain <div>s, so collect every
  // innermost block (a block element with no block descendants) rather than
  // a fixed set of tags. Text pieces are joined with spaces so adjacent
  // label/value spans ("Email" + "...") don't run together.
  const BLOCK = "div, section, article, header, footer, aside, p, ul, ol, li, h1, h2, h3, h4, h5, h6, blockquote, figure, figcaption, dl, dt, dd, table, tr, td, th";
  const lines: string[] = [];
  main.find(BLOCK).each((_, el) => {
    if ($(el).find(BLOCK).length > 0) return;
    const text = textPieces(el)
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/ ([.,;:!?])/g, "$1")
      .trim();
    if (!text) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "h1") lines.push(`# ${text}`);
    else if (tag === "h2") lines.push(`## ${text}`);
    else if (tag === "h3" || tag === "h4") lines.push(`### ${text}`);
    else if (tag === "li") lines.push(`- ${text}`);
    else lines.push(text);
  });

  // Consecutive duplicates come from responsive variants rendered twice.
  const deduped = lines.filter((line, i) => line !== lines[i - 1]);
  return { title, text: deduped.join("\n") };
}

async function syncPages(): Promise<SitePage[]> {
  const routes = discoverRoutes(SITE_APP_DIR)
    .filter((r) => !SKIP_ROUTES.has(r))
    .sort();

  const pages: SitePage[] = [];
  for (const route of routes) {
    const res = await fetch(`${SITE_URL}${route}`);
    if (!res.ok) {
      console.warn(`  skip ${route}: HTTP ${res.status} (not deployed yet?)`);
      continue;
    }
    const { title, text } = extractText(await res.text());
    pages.push({ path: route, title, text });
    console.log(`  ${route.padEnd(36)} ${text.split(/\s+/).length} words`);
  }

  writeFileSync("data/pages.json", JSON.stringify(pages, null, 2) + "\n");
  console.log(`pages: ${pages.length} crawled from ${SITE_URL}`);
  return pages;
}

async function main() {
  syncMentors();
  await syncPages();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
