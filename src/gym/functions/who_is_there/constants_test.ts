import { assertEquals } from "@std/assert";
import { BlockIds } from "./constants.ts";

Deno.test("inputBlock and actionsBlock embed the date in the block id", () => {
  assertEquals(BlockIds.inputBlock("2026-07-28"), "input_block__2026-07-28");
  assertEquals(
    BlockIds.actionsBlock("2026-07-28"),
    "actions_block__2026-07-28",
  );
});

Deno.test("dateFromActionsBlock recovers the date from an actions block id", () => {
  const date = "2026-07-28";
  assertEquals(
    BlockIds.dateFromActionsBlock(BlockIds.actionsBlock(date)),
    date,
  );
});
