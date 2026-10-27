import { describe, expect, it } from "vitest";
import { getMentors } from "./data";
import { createEngine } from "./engine";
import { runTool, TOOLS } from "./tools";

const engine = createEngine(getMentors());
const run = (name: string, input: unknown) => {
  const out = runTool(engine, name, input);
  return { ...out, data: JSON.parse(out.content) };
};

describe("tool definitions", () => {
  it("are plain JSON object schemas without a $schema key", () => {
    for (const tool of TOOLS) {
      expect(tool.input_schema.type, tool.name).toBe("object");
      expect(tool.input_schema, tool.name).not.toHaveProperty("$schema");
    }
  });
});

describe("runTool", () => {
  it("rejects invalid input with an error result instead of throwing", () => {
    const out = run("count_mentors", { filters: { industries: ["Not An Industry"] } });
    expect(out.isError).toBe(true);
    expect(out.data.error).toMatch(/Invalid input/);
  });

  it("rejects unknown tools", () => {
    expect(run("delete_everything", {}).isError).toBe(true);
  });

  it("clamps search limits", () => {
    expect(run("search_mentors", { limit: 500 }).data.mentors).toHaveLength(20);
    expect(run("search_mentors", { limit: 0 }).data.mentors).toHaveLength(1);
  });

  it("returns relevance results without a misleading match count for text queries", () => {
    const data = run("search_mentors", { query: "cloud" }).data;
    expect(data.mostRelevant.length).toBeGreaterThan(0);
    expect(data).not.toHaveProperty("total");
    expect(data.mentorsPassingFilters).toBe(getMentors().length);
  });

  it("returns full bios for known slugs and reports unknown ones", () => {
    const data = run("get_mentors", { slugs: ["dana-deasy", "not-a-mentor"] }).data;
    expect(data.mentors[0].bio.length).toBeGreaterThan(100);
    expect(data.notFound).toEqual(["not-a-mentor"]);
  });

  it("caps get_mentors at 6 slugs", () => {
    const slugs = getMentors().slice(0, 10).map((m) => m.slug);
    expect(run("get_mentors", { slugs }).data.mentors).toHaveLength(6);
  });

  it("counts with a breakdown", () => {
    const data = run("count_mentors", { filters: { regions: ["Europe"] }, groupBy: "city" }).data;
    expect(data.groups.reduce((sum: number, g: { count: number }) => sum + g.count, 0)).toBeLessThanOrEqual(data.total);
  });
});
