import { assertEquals } from "@std/assert";
import { BlockIds } from "./constants.ts";
import {
  whoIsThereFallbackText,
  WhoIsThereItem,
  whoIsThereMergedBlocks,
} from "./blocks.ts";

function item(
  date: string,
  votes: WhoIsThereItem["votes"] = [],
): WhoIsThereItem {
  return { date, requested_by: "U_REQUESTER", votes };
}

Deno.test("whoIsThereMergedBlocks sorts items chronologically", () => {
  const blocks = whoIsThereMergedBlocks([
    item("2026-08-01"),
    item("2026-07-01"),
  ]);

  const inputBlockIds = blocks
    .filter((block) => block.block_id?.startsWith("input_block__"))
    .map((block) => block.block_id);

  assertEquals(inputBlockIds, [
    BlockIds.inputBlock("2026-07-01"),
    BlockIds.inputBlock("2026-08-01"),
  ]);
});

Deno.test("whoIsThereMergedBlocks separates multiple dates with a divider, single date has none leading", () => {
  const single = whoIsThereMergedBlocks([item("2026-07-01")]);
  assertEquals(single[0].type, "section");

  const multiple = whoIsThereMergedBlocks([
    item("2026-07-01"),
    item("2026-08-01"),
  ]);
  const dividerCount =
    multiple.filter((block) => block.type === "divider").length;
  // exactly one divider between the two dates' block groups
  assertEquals(dividerCount, 1);
});

Deno.test("whoIsThereMergedBlocks appends votes for a date when present", () => {
  const blocks = whoIsThereMergedBlocks([
    item("2026-07-01", [{ user_id: "U1", time: "17:00" }]),
  ]);

  const voteSection = blocks.find((block) =>
    block.type === "section" && block.text?.text?.includes("17:00\t<@U1>")
  );
  assertEquals(voteSection !== undefined, true);
});

Deno.test("whoIsThereMergedBlocks omits vote section when there are no votes", () => {
  const blocks = whoIsThereMergedBlocks([item("2026-07-01")]);
  const dividerCount =
    blocks.filter((block) => block.type === "divider").length;
  assertEquals(dividerCount, 0);
});

Deno.test("whoIsThereFallbackText lists every date, sorted and German-formatted", () => {
  const text = whoIsThereFallbackText([item("2026-08-01"), item("2026-07-01")]);
  assertEquals(text, "Wer ist da? Abfragen für 01.07.2026, 01.08.2026");
});
