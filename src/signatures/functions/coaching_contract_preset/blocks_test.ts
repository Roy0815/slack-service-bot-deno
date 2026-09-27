import { assertEquals } from "@std/assert";
import { coachingContractView, readCoachingForm, ViewState } from "./blocks.ts";
import { ActionIds, BlockIds, SavePresetOptionValue } from "./constants.ts";
import { CoachingFields } from "../../coaching_contract.ts";
import { BlockKitObject } from "../../../shared/block_kit.ts";

/** A fully and validly filled form, as Slack would submit it */
function filledState(
  overrides: Record<string, BlockKitObject> = {},
): ViewState {
  return {
    values: {
      [BlockIds.field(CoachingFields.firstName)]: {
        [ActionIds.field]: { type: "plain_text_input", value: " Max " },
      },
      [BlockIds.field(CoachingFields.lastName)]: {
        [ActionIds.field]: { type: "plain_text_input", value: "Muster" },
      },
      [BlockIds.field(CoachingFields.street)]: {
        [ActionIds.field]: { type: "plain_text_input", value: "Hauptstr. 1" },
      },
      [BlockIds.field(CoachingFields.cityPostalcode)]: {
        [ActionIds.field]: {
          type: "plain_text_input",
          value: "68159 Mannheim",
        },
      },
      [BlockIds.savePreset]: {
        [ActionIds.savePreset]: {
          type: "checkboxes",
          selected_options: [{ value: SavePresetOptionValue }],
        },
      },
      [BlockIds.field(CoachingFields.coachingStartDate)]: {
        [ActionIds.field]: { type: "datepicker", selected_date: "2026-10-01" },
      },
      [BlockIds.field(CoachingFields.monthlyRate)]: {
        [ActionIds.field]: { type: "number_input", value: "120.5" },
      },
      [BlockIds.coachEmail]: {
        [ActionIds.coachEmail]: {
          type: "email_text_input",
          value: "coach@example.com",
        },
      },
      [BlockIds.athleteEmail]: {
        [ActionIds.athleteEmail]: {
          type: "email_text_input",
          value: "athlet@example.com",
        },
      },
      ...overrides,
    },
  };
}

// --- View ------------------------------------------------------------------

Deno.test("pre-fills exactly the four preset fields", () => {
  const view = coachingContractView({
    firstName: "Max",
    lastName: "Muster",
    street: "Hauptstr. 1",
    cityPostalcode: "68159 Mannheim",
  });

  const initialValueOf = (blockId: string) =>
    view.blocks.find((block: BlockKitObject) => block.block_id === blockId)
      ?.element.initial_value;

  assertEquals(initialValueOf(BlockIds.field(CoachingFields.firstName)), "Max");
  assertEquals(
    initialValueOf(BlockIds.field(CoachingFields.lastName)),
    "Muster",
  );
  assertEquals(
    initialValueOf(BlockIds.field(CoachingFields.street)),
    "Hauptstr. 1",
  );
  assertEquals(
    initialValueOf(BlockIds.field(CoachingFields.cityPostalcode)),
    "68159 Mannheim",
  );
  assertEquals(initialValueOf(BlockIds.coachEmail), undefined);
  assertEquals(
    initialValueOf(BlockIds.field(CoachingFields.monthlyRate)),
    undefined,
  );
});

Deno.test("pre-fills the coach email when present in the preset", () => {
  const view = coachingContractView({ coachEmail: "coach@example.com" });

  const coachEmailBlock = view.blocks.find((block: BlockKitObject) =>
    block.block_id === BlockIds.coachEmail
  );

  assertEquals(coachEmailBlock?.element.initial_value, "coach@example.com");
});

Deno.test("renders without a preset and with the save box ticked", () => {
  const view = coachingContractView({});

  const saveBlock = view.blocks.find((block: BlockKitObject) =>
    block.block_id === BlockIds.savePreset
  );

  assertEquals(saveBlock.element.initial_options.length, 1);
  assertEquals(view.blocks.length <= 100, true);
});

// --- Reading state ---------------------------------------------------------

Deno.test("reads a filled form into document values and emails", () => {
  const { input, errors } = readCoachingForm(filledState());

  assertEquals(errors, undefined);
  assertEquals(input, {
    values: {
      firstName: "Max",
      lastName: "Muster",
      street: "Hauptstr. 1",
      cityPostalcode: "68159 Mannheim",
      coachingStartDate: "2026-10-01",
      monthlyRate: 120.5,
    },
    savePreset: true,
    coachEmail: "coach@example.com",
    athleteEmail: "athlet@example.com",
  });
});

Deno.test("an unticked save box means the preset is left alone", () => {
  const { input } = readCoachingForm(filledState({
    [BlockIds.savePreset]: {
      [ActionIds.savePreset]: { type: "checkboxes", selected_options: [] },
    },
  }));

  assertEquals(input?.savePreset, false);
});

Deno.test("reports an invalid email next to its input", () => {
  const { input, errors } = readCoachingForm(filledState({
    [BlockIds.athleteEmail]: {
      [ActionIds.athleteEmail]: { type: "email_text_input", value: "nope" },
    },
  }));

  assertEquals(input, undefined);
  assertEquals(Object.keys(errors ?? {}), [BlockIds.athleteEmail]);
});

Deno.test("reports every missing value at once", () => {
  const { errors } = readCoachingForm(filledState({
    [BlockIds.field(CoachingFields.firstName)]: {
      [ActionIds.field]: { type: "plain_text_input", value: "   " },
    },
    [BlockIds.field(CoachingFields.coachingStartDate)]: {
      [ActionIds.field]: { type: "datepicker", selected_date: null },
    },
    [BlockIds.field(CoachingFields.monthlyRate)]: {
      [ActionIds.field]: { type: "number_input", value: null },
    },
  }));

  assertEquals(
    Object.keys(errors ?? {}).sort(),
    [
      BlockIds.field(CoachingFields.coachingStartDate),
      BlockIds.field(CoachingFields.firstName),
      BlockIds.field(CoachingFields.monthlyRate),
    ].sort(),
  );
});
