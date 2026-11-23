import { describe, expect, it } from "vitest";
import { attachmentProblem, extensionOf, formatFileSize, messageTypeFor } from "../src/chat/attachments.js";

const file = (name, size = 1000, type = "") => ({ name, size, type });

describe("attachments", () => {
  it("accepts common types", () => {
    for (const name of ["photo.PNG", "notes.txt", "report.docx", "sheet.xlsx", "slides.pdf", "song.mp3"]) {
      expect(attachmentProblem(file(name))).toBeNull();
    }
  });

  it("rejects unusual types with the type in the message", () => {
    expect(attachmentProblem(file("setup.exe"))).toBe('Couldn\'t add a file of type ".exe".');
    expect(attachmentProblem(file("README"))).toBe('Couldn\'t add a file of type "unknown".');
    expect(attachmentProblem(file("drawing.svg"))).toMatch(/\.svg/);
  });

  it("rejects files over 25 MB", () => {
    expect(attachmentProblem(file("big.zip", 26 * 1024 * 1024))).toMatch(/too large/);
  });

  it("picks the message type", () => {
    expect(messageTypeFor(file("a.png", 1, "image/png"))).toBe("image");
    expect(messageTypeFor(file("a.mp3", 1, "audio/mpeg"))).toBe("voice");
    expect(messageTypeFor(file("a.txt", 1, "text/plain"))).toBe("file");
  });

  it("helpers", () => {
    expect(extensionOf("Archive.TAR.GZ")).toBe("gz");
    expect(formatFileSize(1536)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
