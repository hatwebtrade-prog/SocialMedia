import { describe, it, expect } from "vitest";
import { describeMetaContent } from "./describe";

const base = { piattaforme: ["FACEBOOK", "INSTAGRAM"] };

describe("describeMetaContent", () => {
  it("POST con immagine -> image, caption dal payload, asset ordinati", () => {
    const d = describeMetaContent({
      ...base, formato: "POST",
      payload: { caption: "Ciao" },
      assets: [{ path: "uploads/b.png", slideIndex: 1 }, { path: "uploads/a.png", slideIndex: 0 }],
    });
    expect(d.postType).toBe("image");
    expect(d.caption).toBe("Ciao");
    expect(d.platforms).toEqual(["facebook", "instagram"]);
    expect(d.assetPaths).toEqual(["uploads/a.png", "uploads/b.png"]);
  });
  it("POST senza asset -> text", () => {
    const d = describeMetaContent({ ...base, formato: "POST", payload: { caption: "Solo testo" }, assets: [] });
    expect(d.postType).toBe("text");
    expect(d.assetPaths).toEqual([]);
  });
  it("CAROSELLO -> carousel", () => {
    const d = describeMetaContent({ ...base, formato: "CAROSELLO", payload: { caption: "C" }, assets: [{ path: "x.png", slideIndex: 0 }] });
    expect(d.postType).toBe("carousel");
  });
  it("STORY -> story, caption da payload.testo", () => {
    const d = describeMetaContent({ ...base, formato: "STORY", payload: { testo: "overlay" }, assets: [{ path: "s.png", slideIndex: null }] });
    expect(d.postType).toBe("story");
    expect(d.caption).toBe("overlay");
  });
  it("mappa solo le piattaforme note", () => {
    const d = describeMetaContent({ piattaforme: ["FACEBOOK", "TIKTOK"], formato: "POST", payload: { caption: "x" }, assets: [{ path: "a.png", slideIndex: 0 }] });
    expect(d.platforms).toEqual(["facebook"]);
  });
});
