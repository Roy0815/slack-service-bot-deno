import { assertEquals } from "@std/assert";
import { bankChangeView, readChangeDate, ViewState } from "./blocks.ts";
import { ActionIds, BlockIds } from "./constants.ts";
import { BlockKitObject } from "../../../shared/block_kit.ts";

function dateState(changeDate: string | null): ViewState {
  return {
    values: {
      [BlockIds.changeDate]: {
        [ActionIds.changeDate]: {
          type: "datepicker",
          selected_date: changeDate,
        },
      },
    },
  };
}

Deno.test("shows the email read-only and carries it in private_metadata", () => {
  const view = bankChangeView("max@example.com");
  const emailBlock = view.blocks.find((block: BlockKitObject) =>
    block.block_id === BlockIds.email
  );

  assertEquals(emailBlock.type, "section");
  assertEquals(emailBlock.text.text.includes("max@example.com"), true);
  assertEquals(view.private_metadata, "max@example.com");
  // the date is the only input - nothing else the user could change
  assertEquals(
    view.blocks.filter((block: BlockKitObject) => block.type === "input")
      .length,
    1,
  );
});

Deno.test("shows the lead time hint right below the date", () => {
  const blocks = bankChangeView("m@example.com").blocks;
  const dateIndex = blocks.findIndex((block: BlockKitObject) =>
    block.block_id === BlockIds.changeDate
  );

  assertEquals(blocks[dateIndex + 1].type, "context");
  assertEquals(
    blocks[dateIndex + 1].elements[0].text.includes("1 bis 2 Wochen"),
    true,
  );
});

Deno.test("reads the change date, today included", () => {
  assertEquals(readChangeDate(dateState("2026-11-15"), "2026-10-28"), {
    changeDate: "2026-11-15",
  });
  assertEquals(readChangeDate(dateState("2026-10-28"), "2026-10-28"), {
    changeDate: "2026-10-28",
  });
});

Deno.test("rejects a missing date or one in the past", () => {
  for (const date of [null, "2026-10-27"]) {
    assertEquals(
      Object.keys(readChangeDate(dateState(date), "2026-10-28").errors ?? {}),
      [BlockIds.changeDate],
    );
  }
});
