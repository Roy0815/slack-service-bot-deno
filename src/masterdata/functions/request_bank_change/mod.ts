import { RequestBankChangeFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { ModalCallbackId } from "./constants.ts";
import {
  bankChangeView,
  loadingView,
  messageView,
  readChangeDate,
  ViewState,
} from "./blocks.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import { assertOk, errorMessage, today } from "../../../shared/util.ts";

/**
 * Opens the bank details change popup showing the member's email from the
 * masterdata, and hands the chosen change date to the next step.
 *
 * The function stays alive (`completed: false`) until the modal is
 * submitted or closed - otherwise the workflow would move on before the
 * user has entered anything.
 */
export default SlackFunction(
  RequestBankChangeFunction,
  async ({ inputs, client, env }) => {
    try {
      const opened = assertOk(
        await client.views.open({
          interactivity_pointer: inputs.interactivity.interactivity_pointer,
          view: loadingView(),
        }),
        "RequestBankChangeFunction - Error opening modal",
      );

      const showView = async (view: unknown) =>
        assertOk(
          await client.views.update({ view_id: opened.view.id, view }),
          "RequestBankChangeFunction - Error updating modal",
        );

      let email: string | undefined;
      try {
        email = (await getMasterdataService(env).getUserFromId({
          slackId: inputs.interactivity.interactor.id,
        }))?.email || undefined;
      } catch (error) {
        await showView(messageView(
          ":warning: Deine Stammdaten konnten gerade nicht geladen werden. Bitte versuche es später noch einmal.",
        ));
        return {
          error: `Stammdaten konnten nicht geladen werden: ${
            errorMessage(error)
          }`,
        };
      }

      if (!email) {
        await showView(messageView(
          ":warning: In deinen Stammdaten ist keine E-Mail-Adresse hinterlegt. Bitte trage sie zuerst in den Stammdaten ein. Sobald die Änderung genehmigt ist, kannst du es hier noch einmal versuchen.",
        ));
        return { error: "Keine E-Mail-Adresse in den Stammdaten" };
      }

      await showView(bankChangeView(email));

      // IMPORTANT! Keep the execution open so the modal stays interactive
      return { completed: false };
    } catch (error) {
      return {
        error: `Formular konnte nicht geöffnet werden: ${errorMessage(error)}`,
      };
    }
  },
)
  .addViewSubmissionHandler(
    ModalCallbackId,
    async ({ body, view, client, inputs }) => {
      const { changeDate, errors } = readChangeDate(
        view.state as ViewState,
        today(),
      );

      // Keeps the modal open with the message next to the date
      if (errors) return { response_action: "errors", errors };

      const executionId = body.function_data.execution_id;

      try {
        assertOk(
          await client.functions.completeSuccess({
            function_execution_id: executionId,
            outputs: {
              user: inputs.interactivity.interactor.id,
              changeDate,
              email: view.private_metadata,
            },
          }),
          "RequestBankChangeFunction - Error completing execution",
        );
      } catch (error) {
        await client.functions.completeError({
          function_execution_id: executionId,
          error: `Formular konnte nicht verarbeitet werden: ${
            errorMessage(error)
          }`,
        });
      }
    },
  )
  // Without this the workflow would hang forever when the user just closes
  // the modal instead of submitting it. After a message view the execution
  // has already ended, so this call fails harmlessly.
  .addViewClosedHandler(ModalCallbackId, async ({ body, client }) => {
    await client.functions.completeError({
      function_execution_id: body.function_data.execution_id,
      error: "Kontodaten-Änderung abgebrochen",
    });
  });
