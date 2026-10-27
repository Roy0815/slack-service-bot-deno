import { assertEquals } from "@std/assert";
import { buildVCard } from "./util.ts";

Deno.test("buildVCard builds a CRLF-separated vCard 3.0 with name, email and phone", () => {
  const vCard = buildVCard({
    firstname: "Max",
    lastname: "Mustermann",
    email: "max@example.com",
    phone: "'+491701234567",
  });

  assertEquals(
    vCard,
    "BEGIN:VCARD\r\n" +
      "VERSION:3.0\r\n" +
      "N:Mustermann;Max\r\n" +
      "FN:Max Mustermann\r\n" +
      "EMAIL:max@example.com\r\n" +
      "TEL;TYPE=voice:+491701234567\r\n" +
      "END:VCARD",
  );
});
