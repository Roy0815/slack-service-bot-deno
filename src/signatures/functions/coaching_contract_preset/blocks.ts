import {
  ActionIds,
  BlockIds,
  ModalCallbackId,
  SavePresetOptionValue,
} from "./constants.ts";
import {
  CoachingFieldName,
  CoachingFields,
  PresetFieldName,
} from "../../coaching_contract.ts";
import { SignatureValue } from "../../lib/types.ts";
import { BlockKitObject } from "../../../shared/block_kit.ts";
import { EmailPattern } from "../../../shared/util.ts";

/** The saved personal data, used to pre-fill the form */
export type PresetValues = Partial<Record<PresetFieldName, string>> & {
  coachEmail?: string;
};

/** Everything a submitted form yields */
export type CoachingFormInput = {
  /** All six document values, keyed by the template's field names */
  values: Record<CoachingFieldName, SignatureValue>;
  savePreset: boolean;
  coachEmail: string;
  athleteEmail: string;
};

/**
 * The shape of `view.state` - Block Kit state is a
 * `{ [block_id]: { [action_id]: element } }` map whose element type depends
 * on the element that produced it.
 */
export type ViewState = {
  values?: Record<string, Record<string, BlockKitObject>>;
};

// --- View ------------------------------------------------------------------

/**
 * The coaching contract form. Deliberately hand-written rather than derived
 * from the template: the field set is fixed and small, and a static form is
 * easier to read and to reason about than a generic renderer.
 */
export function coachingContractView(preset: PresetValues): BlockKitObject {
  const saveOption = {
    text: {
      type: "plain_text",
      text: "Diese Daten für das nächste Mal speichern",
    },
    value: SavePresetOptionValue,
  };

  return {
    type: "modal",
    callback_id: ModalCallbackId,
    // required for addViewClosedHandler to fire when the user hits "Abbrechen"
    notify_on_close: true,
    title: { type: "plain_text", text: "Coaching-Vertrag" },
    submit: { type: "plain_text", text: "Weiter" },
    close: { type: "plain_text", text: "Abbrechen" },
    blocks: [
      headerBlock("Deine Daten (Coach)"),
      contextBlock(
        "Werden im Vertrag als Coach-Angaben eingetragen und können für das nächste Mal gespeichert werden.",
      ),
      textInput(CoachingFields.firstName, "Vorname", preset.firstName),
      textInput(CoachingFields.lastName, "Nachname", preset.lastName),
      textInput(CoachingFields.street, "Straße und Hausnummer", preset.street),
      textInput(
        CoachingFields.cityPostalcode,
        "PLZ und Ort",
        preset.cityPostalcode,
      ),
      {
        type: "input",
        block_id: BlockIds.savePreset,
        // an unticked checkbox submits no selection, which a required
        // input block would reject
        optional: true,
        label: { type: "plain_text", text: "Speichern" },
        element: {
          type: "checkboxes",
          action_id: ActionIds.savePreset,
          options: [saveOption],
          initial_options: [saveOption],
        },
      },

      headerBlock("Coaching"),
      {
        type: "input",
        block_id: BlockIds.field(CoachingFields.coachingStartDate),
        label: { type: "plain_text", text: "Beginn des Coachings" },
        element: {
          type: "datepicker",
          action_id: ActionIds.field,
          placeholder: { type: "plain_text", text: "Datum wählen" },
        },
      },
      {
        type: "input",
        block_id: BlockIds.field(CoachingFields.monthlyRate),
        label: { type: "plain_text", text: "Monatliche Kosten (€)" },
        element: {
          type: "number_input",
          action_id: ActionIds.field,
          is_decimal_allowed: true,
          min_value: "0",
          placeholder: { type: "plain_text", text: "z. B. 120" },
        },
      },

      headerBlock("Beteiligte"),
      contextBlock(
        "Nicht Teil des Dokuments - an diese Adressen geht die Signaturanfrage.",
      ),
      emailInput(
        BlockIds.coachEmail,
        ActionIds.coachEmail,
        "E-Mail Coach",
        preset.coachEmail,
      ),
      emailInput(
        BlockIds.athleteEmail,
        ActionIds.athleteEmail,
        "E-Mail Athlet",
      ),
    ],
  };
}

function headerBlock(text: string): BlockKitObject {
  return { type: "header", text: { type: "plain_text", text } };
}

function contextBlock(text: string): BlockKitObject {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}

function textInput(
  name: CoachingFieldName,
  label: string,
  initialValue?: string,
): BlockKitObject {
  return {
    type: "input",
    block_id: BlockIds.field(name),
    label: { type: "plain_text", text: label },
    element: {
      type: "plain_text_input",
      action_id: ActionIds.field,
      ...(initialValue ? { initial_value: initialValue } : {}),
    },
  };
}

function emailInput(
  blockId: string,
  actionId: string,
  label: string,
  initialValue?: string,
): BlockKitObject {
  return {
    type: "input",
    block_id: blockId,
    label: { type: "plain_text", text: label },
    element: {
      type: "email_text_input",
      action_id: actionId,
      placeholder: { type: "plain_text", text: "name@example.com" },
      ...(initialValue ? { initial_value: initialValue } : {}),
    },
  };
}

// --- Reading the submitted state -------------------------------------------

/**
 * Turns the submitted view state into the form's values, or into
 * per-block error messages Slack shows next to the offending inputs.
 *
 * Slack already enforces that required inputs are filled, so the checks
 * here are the ones it cannot do: email format and a usable number.
 */
export function readCoachingForm(
  state: ViewState,
): { input: CoachingFormInput; errors?: undefined } | {
  input?: undefined;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const text = (name: CoachingFieldName): string => {
    const value = readText(state, BlockIds.field(name), ActionIds.field);
    if (!value) errors[BlockIds.field(name)] = "Bitte ausfüllen";
    return value ?? "";
  };

  const firstName = text(CoachingFields.firstName);
  const lastName = text(CoachingFields.lastName);
  const street = text(CoachingFields.street);
  const cityPostalcode = text(CoachingFields.cityPostalcode);

  const startBlock = BlockIds.field(CoachingFields.coachingStartDate);
  const coachingStartDate: string | undefined =
    state.values?.[startBlock]?.[ActionIds.field]?.selected_date ?? undefined;
  if (!coachingStartDate) errors[startBlock] = "Bitte ein Datum wählen";

  const rateBlock = BlockIds.field(CoachingFields.monthlyRate);
  const rawRate = readText(state, rateBlock, ActionIds.field);
  const monthlyRate = Number(rawRate);
  if (!rawRate || !Number.isFinite(monthlyRate)) {
    errors[rateBlock] = "Bitte einen Betrag eingeben";
  }

  const coachEmail = readEmail(
    state,
    BlockIds.coachEmail,
    ActionIds.coachEmail,
    errors,
  );
  const athleteEmail = readEmail(
    state,
    BlockIds.athleteEmail,
    ActionIds.athleteEmail,
    errors,
  );

  if (Object.keys(errors).length > 0) return { errors };

  const savePreset =
    (state.values?.[BlockIds.savePreset]?.[ActionIds.savePreset]
      ?.selected_options ?? []).length > 0;

  return {
    input: {
      values: {
        firstName,
        lastName,
        street,
        cityPostalcode,
        coachingStartDate: coachingStartDate!,
        monthlyRate,
      },
      savePreset,
      coachEmail: coachEmail!,
      athleteEmail: athleteEmail!,
    },
  };
}

function readText(
  state: ViewState,
  blockId: string,
  actionId: string,
): string | undefined {
  return state.values?.[blockId]?.[actionId]?.value?.trim() || undefined;
}

function readEmail(
  state: ViewState,
  blockId: string,
  actionId: string,
  errors: Record<string, string>,
): string | undefined {
  const email = readText(state, blockId, actionId);

  if (!email) {
    errors[blockId] = "Bitte eine E-Mail-Adresse angeben";
    return undefined;
  }
  if (!EmailPattern.test(email)) {
    errors[blockId] = "Keine gültige E-Mail-Adresse";
    return undefined;
  }

  return email;
}
