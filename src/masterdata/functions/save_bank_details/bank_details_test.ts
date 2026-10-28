import { assertEquals, assertThrows } from "@std/assert";
import {
  normalizeBic,
  normalizeIban,
  normalizeSigningDate,
} from "./bank_details.ts";

Deno.test("normalizeIban strips spaces and upper-cases a valid IBAN", () => {
  assertEquals(
    normalizeIban(" de89 3704 0044 0532 0130 00 "),
    "DE89370400440532013000",
  );
});

Deno.test("normalizeIban rejects a wrong check digit", () => {
  assertThrows(
    () => normalizeIban("DE88370400440532013000"),
    Error,
    "Prüfziffer",
  );
});

Deno.test("normalizeIban rejects input that is no IBAN at all", () => {
  for (const iban of ["", "12345", "DE89 3704"]) {
    assertThrows(() => normalizeIban(iban), Error, "keine gültige IBAN");
  }
});

Deno.test("normalizeBic accepts 8 and 11 character BICs", () => {
  assertEquals(normalizeBic("cobadeffxxx"), "COBADEFFXXX");
  assertEquals(normalizeBic("COBA DEFF"), "COBADEFF");
});

Deno.test("normalizeBic rejects malformed BICs", () => {
  for (const bic of ["", "COBADE", "COBADEFFXX"]) {
    assertThrows(() => normalizeBic(bic), Error, "keine gültige BIC");
  }
});

Deno.test("normalizeSigningDate turns webhook ISO text into the German format", () => {
  assertEquals(normalizeSigningDate(" 2026-10-28 "), "28.10.2026");
});

Deno.test("normalizeSigningDate treats empty text as not given", () => {
  assertEquals(normalizeSigningDate(""), undefined);
  assertEquals(normalizeSigningDate("   "), undefined);
  assertEquals(normalizeSigningDate(undefined), undefined);
});

Deno.test("normalizeSigningDate rejects other formats and impossible dates", () => {
  for (const date of ["28.10.2026", "2026-2-3", "2026-02-30", "heute"]) {
    assertThrows(
      () => normalizeSigningDate(date),
      Error,
      "kein gültiges Unterschriftsdatum",
    );
  }
});
