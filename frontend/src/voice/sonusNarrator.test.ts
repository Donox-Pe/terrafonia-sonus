import { describe, expect, it } from "vitest";
import {
  getSonusChapters,
  pickBestSpanishVoice,
  pickBestVoice,
  SONUS_CHAPTERS,
} from "./sonusNarrator";

describe("sonusNarrator", () => {
  it("incluye los 4 capítulos completos en español e inglés", () => {
    expect(SONUS_CHAPTERS).toHaveLength(4);
    const enChapters = getSonusChapters("en");
    expect(enChapters).toHaveLength(4);
    expect(SONUS_CHAPTERS.map((c) => c.id)).toEqual([
      "que-es",
      "como-funciona",
      "proposito",
      "expectativas",
    ]);
    for (const ch of [...SONUS_CHAPTERS, ...enChapters]) {
      expect(ch.text.length).toBeGreaterThan(80);
    }
  });

  it("prioriza voces masculinas naturales en español y en inglés", () => {
    const chosenEs = pickBestSpanishVoice([
      { name: "Microsoft David", lang: "en-US" },
      { name: "Microsoft Dalia Online (Natural) - Spanish (Mexico)", lang: "es-MX" },
      { name: "Microsoft Jorge Online (Natural) - Spanish (Mexico)", lang: "es-MX" },
    ]);
    expect(chosenEs?.name).toContain("Jorge");

    const chosenEn = pickBestVoice(
      [
        { name: "Microsoft Jenny Online (Natural) - English (United States)", lang: "en-US" },
        { name: "Microsoft Andrew Online (Natural) - English (United States)", lang: "en-US" },
      ],
      "en",
    );
    expect(chosenEn?.name).toContain("Andrew");
  });

  it("retorna null si no existen voces en el idioma solicitado", () => {
    expect(pickBestSpanishVoice([{ name: "Alex", lang: "en-US" }])).toBeNull();
    expect(pickBestVoice([{ name: "Jorge", lang: "es-MX" }], "en")).toBeNull();
  });
});
