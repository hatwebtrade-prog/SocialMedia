import { describe, it, expect } from "vitest";
import { pickFileKind, extractText } from "@/lib/knowledge/extract";

describe("pickFileKind", () => {
  it("classifies images vs documents vs unsupported", () => {
    expect(pickFileKind("image/png")).toBe("IMMAGINE");
    expect(pickFileKind("image/jpeg")).toBe("IMMAGINE");
    expect(pickFileKind("application/pdf")).toBe("DOCUMENTO");
    expect(pickFileKind("text/plain")).toBe("DOCUMENTO");
    expect(pickFileKind("text/markdown")).toBe("DOCUMENTO");
    expect(pickFileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCUMENTO");
    expect(pickFileKind("application/zip")).toBeNull();
  });
});

describe("extractText (text formats)", () => {
  it("decodes utf-8 for text/plain and markdown", async () => {
    const buf = Buffer.from("# Titolo\nContenuto àèì", "utf-8");
    expect(await extractText(buf, "text/plain", "a.txt")).toContain("Contenuto àèì");
    expect(await extractText(buf, "text/markdown", "a.md")).toContain("Titolo");
  });
});
