import { assertEquals } from "@std/assert";
import { guessMimeType } from "./mime_types.ts";

Deno.test("guessMimeType resolves known extensions", () => {
  assertEquals(guessMimeType("invoice.pdf"), "application/pdf");
  assertEquals(guessMimeType("photo.JPG"), "image/jpeg");
  assertEquals(
    guessMimeType("report.docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
});

Deno.test("guessMimeType falls back to application/octet-stream for unknown extensions", () => {
  assertEquals(guessMimeType("archive.zip"), "application/octet-stream");
  assertEquals(guessMimeType("no-extension"), "application/octet-stream");
});
