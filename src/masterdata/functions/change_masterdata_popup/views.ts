import { UserMaintenanceDetails } from "../../../shared/masterdata/types.ts";

export const changeMasterdataViewCallbackId = "change_masterdata_modal";

export const BlockIds: Record<keyof UserMaintenanceDetails, string> = {
  firstname: "field_firstname",
  lastname: "field_lastname",
  email: "field_email",
  phone: "field_phone",
  street: "field_street",
  houseNumber: "field_houseNumber",
  city: "field_city",
  zip: "field_zip",
};

export const ActionIds: Record<keyof UserMaintenanceDetails, string> = {
  firstname: "input_firstname",
  lastname: "input_lastname",
  email: "input_email",
  phone: "input_phone",
  street: "input_street",
  houseNumber: "input_houseNumber",
  city: "input_city",
  zip: "input_zip",
};

const LOADING_PLACEHOLDER = "Lädt...";

function field(
  key: keyof UserMaintenanceDetails,
  label: string,
  placeholder: string | undefined,
  options: {
    elementType?: "plain_text_input" | "email_text_input";
    hint?: string;
  } = {},
  // deno-lint-ignore no-explicit-any
): any {
  return {
    type: "input",
    block_id: BlockIds[key],
    optional: true,
    label: { type: "plain_text", text: label },
    element: {
      type: options.elementType ?? "plain_text_input",
      action_id: ActionIds[key],
      placeholder: { type: "plain_text", text: placeholder ?? "" },
    },
    ...(options.hint
      ? { hint: { type: "plain_text", text: options.hint } }
      : {}),
  };
}

/**
 * Builds the "Stammdaten ändern" popup. `placeholders` should hold the
 * user's current values (or be empty/partial while still loading - see
 * mod.ts, which opens with `{}` first and fills this in via views.update
 * once the masterdata service has responded).
 */
export function changeMasterdataModal(
  placeholders: Partial<UserMaintenanceDetails>,
  loading: boolean,
  // deno-lint-ignore no-explicit-any
): any {
  const placeholderFor = (key: keyof UserMaintenanceDetails) =>
    loading ? LOADING_PLACEHOLDER : placeholders[key];

  return {
    type: "modal",
    callback_id: changeMasterdataViewCallbackId,
    title: { type: "plain_text", text: "Stammdaten ändern" },
    submit: { type: "plain_text", text: "Speichern" },
    close: { type: "plain_text", text: "Abbrechen" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "Bitte nur die Felder ausfüllen, die geändert werden sollen :slightly_smiling_face:",
        },
      },
      field("firstname", "Vorname", placeholderFor("firstname")),
      field("lastname", "Nachname", placeholderFor("lastname")),
      field("email", "Email", placeholderFor("email"), {
        elementType: "email_text_input",
      }),
      field("phone", "Telefonnummer", placeholderFor("phone"), {
        hint: "Format: +49162123456",
      }),
      field("street", "Straße", placeholderFor("street")),
      field("houseNumber", "Hausnummer", placeholderFor("houseNumber")),
      field("city", "Stadt", placeholderFor("city")),
      field("zip", "Postleitzahl", placeholderFor("zip")),
    ],
  };
}
