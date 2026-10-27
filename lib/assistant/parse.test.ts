import { describe, expect, it } from "vitest";
import { decodeEntities, parseFocusAreas, parseLocation, splitValues } from "./parse";

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Digital &amp; Business")).toBe("Digital & Business");
    expect(decodeEntities("O&#39;Sullivan &#x2013; CTO")).toBe("O'Sullivan – CTO");
  });

  it("decodes &amp; last so double-encoded text stays literal", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });
});

describe("splitValues", () => {
  it("splits on commas only after decoding, keeping & inside values", () => {
    expect(splitValues("C-Level Management, Digital &amp; Business Transformation")).toEqual([
      "C-Level Management",
      "Digital & Business Transformation",
    ]);
  });
});

describe("parseLocation", () => {
  it("handles city, state, country", () => {
    expect(parseLocation("New York, NY, United States")).toEqual({ city: "New York", state: "NY", country: "United States" });
  });

  it("handles city, country", () => {
    expect(parseLocation("London, United Kingdom")).toEqual({ city: "London", state: "", country: "United Kingdom" });
  });

  it("handles country only and empty", () => {
    expect(parseLocation("Canada")).toEqual({ city: "", state: "", country: "Canada" });
    expect(parseLocation("")).toEqual({ city: "", state: "", country: "" });
  });
});

describe("parseFocusAreas", () => {
  it("keeps only the site's official focus areas", () => {
    expect(parseFocusAreas("Cybersecurity, Privacy, Data Management &amp; Analytics")).toEqual([
      "Cybersecurity",
      "Data Management & Analytics",
    ]);
  });
});
