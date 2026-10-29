import { ActionIds, BlockIds, ModalCallbackId } from "./constants.ts";
import { BlockKitObject } from "../../../shared/block_kit.ts";

/**
 * The shape of `view.state` - Block Kit state is a
 * `{ [block_id]: { [action_id]: element } }` map whose element type depends
 * on the element that produced it.
 */
export type ViewState = {
  values?: Record<string, Record<string, BlockKitObject>>;
};

const title = { type: "plain_text", text: "Kontodaten ändern" };

// --- Views -----------------------------------------------------------------

/**
 * Shown right away so the interactivity pointer is used within its few
 * seconds - the member's email is looked up afterwards and the view is
 * then replaced by bankChangeView or messageView.
 */
export function loadingView(): BlockKitObject {
  return messageView(":hourglass_flowing_sand: Lade deine Daten ...");
}

/** A view without submit button, for anything that ends the request */
export function messageView(text: string): BlockKitObject {
  return {
    type: "modal",
    callback_id: ModalCallbackId,
    notify_on_close: true,
    title,
    close: { type: "plain_text", text: "Schließen" },
    blocks: [{ type: "section", text: { type: "mrkdwn", text } }],
  };
}

/**
 * The email is shown, not editable: the form must only ever go to the
 * address in the masterdata, otherwise anyone could have a debit moved to
 * an account of their choosing. It rides along in `private_metadata`,
 * which the user can't touch.
 */
export function bankChangeView(email: string): BlockKitObject {
  return {
    type: "modal",
    callback_id: ModalCallbackId,
    // required for addViewClosedHandler to fire when the user hits "Abbrechen"
    notify_on_close: true,
    private_metadata: email,
    title,
    submit: { type: "plain_text", text: "Absenden" },
    close: { type: "plain_text", text: "Abbrechen" },
    blocks: [
      {
        type: "input",
        block_id: BlockIds.changeDate,
        label: { type: "plain_text", text: "Änderung gültig ab" },
        element: {
          type: "datepicker",
          action_id: ActionIds.changeDate,
          placeholder: { type: "plain_text", text: "Datum wählen" },
        },
      },
      contextBlock(
        ":information_source: Die Änderung benötigt 1 bis 2 Wochen Vorlauf.",
      ),
      {
        type: "section",
        block_id: BlockIds.email,
        text: { type: "mrkdwn", text: `*E-Mail-Adresse*\n${email}` },
      },
      contextBlock(
        ":lock: Die Adresse kommt aus deinen Stammdaten. Möchtest du sie ändern, passe sie bitte zuerst in den Stammdaten an. Sobald die Änderung genehmigt ist, kannst du es hier noch einmal versuchen.",
      ),
      contextBlock(
        ":email: Nach dem Absenden bekommst du an diese Adresse eine E-Mail mit dem Formular für deine neuen Kontodaten. Bitte fülle es aus und unterschreibe es.",
      ),
    ],
  };
}

function contextBlock(text: string): BlockKitObject {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}

// --- Reading the submitted state -------------------------------------------

/**
 * Reads the change date (YYYY-MM-DD, as the datepicker submits it), or an
 * error message Slack shows next to the date. `today` is YYYY-MM-DD - a
 * change can't take effect in the past.
 */
export function readChangeDate(
  state: ViewState,
  today: string,
): { changeDate: string; errors?: undefined } | {
  changeDate?: undefined;
  errors: Record<string, string>;
} {
  const changeDate: string | undefined =
    state.values?.[BlockIds.changeDate]?.[ActionIds.changeDate]
      ?.selected_date ?? undefined;

  if (!changeDate) {
    return { errors: { [BlockIds.changeDate]: "Bitte ein Datum wählen" } };
  }
  // ISO dates compare correctly as strings
  if (changeDate < today) {
    return {
      errors: {
        [BlockIds.changeDate]:
          "Das Datum darf nicht in der Vergangenheit liegen",
      },
    };
  }

  return { changeDate };
}
