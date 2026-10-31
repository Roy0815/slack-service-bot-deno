import { assertEquals } from "@std/assert";
import { ActionIds, BlockIds, changeMasterdataModal } from "./views.ts";

// deno-lint-ignore no-explicit-any
function findField(view: any, blockId: string) {
  return view.blocks.find((block: { block_id?: string }) =>
    block.block_id === blockId
  );
}

Deno.test("changeMasterdataModal shows a loading placeholder for every field while loading", () => {
  const view = changeMasterdataModal({}, true);

  const firstname = findField(view, BlockIds.firstname);
  assertEquals(firstname.element.placeholder.text, "Lädt...");
});

Deno.test("changeMasterdataModal shows the user's current values once loaded", () => {
  const view = changeMasterdataModal(
    { firstname: "Max", city: "Mannheim" },
    false,
  );

  assertEquals(
    findField(view, BlockIds.firstname).element.placeholder.text,
    "Max",
  );
  assertEquals(
    findField(view, BlockIds.city).element.placeholder.text,
    "Mannheim",
  );
  // fields with no current value fall back to an empty placeholder, not "Lädt..."
  assertEquals(findField(view, BlockIds.lastname).element.placeholder.text, "");
});

Deno.test("changeMasterdataModal uses an email input for the email field and a hint for phone", () => {
  const view = changeMasterdataModal({}, false);

  assertEquals(
    findField(view, BlockIds.email).element.type,
    "email_text_input",
  );
  assertEquals(
    findField(view, BlockIds.phone).hint.text,
    "Format: +49162123456",
  );
});

Deno.test("every field is optional and has a matching action id", () => {
  const view = changeMasterdataModal({}, false);

  for (const key of Object.keys(BlockIds) as (keyof typeof BlockIds)[]) {
    const block = findField(view, BlockIds[key]);
    assertEquals(block.optional, true);
    assertEquals(block.element.action_id, ActionIds[key]);
  }
});
