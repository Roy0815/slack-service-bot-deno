import { assertEquals } from "@std/assert";
import { BlockIds, whoIsThereStartModal } from "./views.ts";
import { today } from "../../../shared/util.ts";

Deno.test("whoIsThereStartModal shows the given channel and a date input", () => {
  const view = whoIsThereStartModal("C123");

  assertEquals(view.type, "modal");
  assertEquals(view.title.text, "Wer ist da?");
  // Slack caps modal titles at 24 characters
  assertEquals(view.title.text.length <= 24, true);
  assertEquals(view.blocks[0].text.text.includes("<#C123>"), true);

  const dateBlock = view.blocks.find((block: { block_id?: string }) =>
    block.block_id === BlockIds.date
  );
  assertEquals(dateBlock.element.type, "datepicker");
  assertEquals(dateBlock.element.initial_date, today());
});
