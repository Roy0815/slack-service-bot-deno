import { CoachingContractPresetFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import { ModalCallbackId } from "./constants.ts";
import {
  coachingContractView,
  PresetValues,
  readCoachingForm,
  ViewState,
} from "./blocks.ts";
import CoachingPresetsDatastore from "../../datastores/coaching_presets.ts";
import { PresetFieldName, PresetFields } from "../../coaching_contract.ts";
import { assertOk, errorMessage } from "../../../shared/util.ts";

/**
 * Opens the coaching contract form pre-filled with the user's saved
 * personal data, and hands the submitted values to the next step.
 *
 * The function stays alive (`completed: false`) until the modal is
 * submitted or closed - otherwise the workflow would move on before the
 * user has entered anything.
 */
export default SlackFunction(
  CoachingContractPresetFunction,
  async ({ inputs, client }) => {
    try {
      const preset = await loadPreset(
        client,
        inputs.interactivity.interactor.id,
      );

      assertOk(
        await client.views.open({
          interactivity_pointer: inputs.interactivity.interactivity_pointer,
          view: coachingContractView(preset),
        }),
        "CoachingContractPresetFunction - Error opening modal",
      );

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
      const { input, errors } = readCoachingForm(view.state as ViewState);

      // Keeps the modal open with the message next to the offending input
      if (errors) return { response_action: "errors", errors };

      const executionId = body.function_data.execution_id;

      try {
        if (input.savePreset) {
          await savePreset(
            client,
            inputs.interactivity.interactor.id,
            input.values,
            input.coachEmail,
          );
        }

        assertOk(
          await client.functions.completeSuccess({
            function_execution_id: executionId,
            outputs: {
              documentValues: JSON.stringify(input.values),
              coachEmail: input.coachEmail,
              athleteEmail: input.athleteEmail,
            },
          }),
          "CoachingContractPresetFunction - Error completing execution",
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
  // the modal instead of submitting it.
  .addViewClosedHandler(ModalCallbackId, async ({ body, client }) => {
    await client.functions.completeError({
      function_execution_id: body.function_data.execution_id,
      error: "Coaching-Vertrag abgebrochen",
    });
  });

/**
 * A missing preset (first run) or a failed lookup both mean "nothing to
 * pre-fill" - the form is still perfectly usable with empty fields, so
 * neither is worth failing the step over.
 */
async function loadPreset(
  client: SlackAPIClient,
  userId: string,
): Promise<PresetValues> {
  const response = await client.apps.datastore.get<
    typeof CoachingPresetsDatastore.definition
  >({
    datastore: CoachingPresetsDatastore.name,
    id: userId,
  });

  if (!response.ok || !response.item) return {};

  const preset: PresetValues = {};
  for (const field of PresetFields) {
    const value = response.item[field];
    if (typeof value === "string" && value !== "") preset[field] = value;
  }

  const coachEmail = response.item.coachEmail;
  if (typeof coachEmail === "string" && coachEmail !== "") {
    preset.coachEmail = coachEmail;
  }

  return preset;
}

async function savePreset(
  client: SlackAPIClient,
  userId: string,
  values: Record<PresetFieldName, unknown>,
  coachEmail: string,
): Promise<void> {
  assertOk(
    await client.apps.datastore.put<
      typeof CoachingPresetsDatastore.definition
    >({
      datastore: CoachingPresetsDatastore.name,
      item: {
        // same user -> same key -> overwrite instead of a second entry
        user_id: userId,
        updated_at: new Date().toISOString(),
        firstName: String(values.firstName),
        lastName: String(values.lastName),
        street: String(values.street),
        cityPostalcode: String(values.cityPostalcode),
        coachEmail,
      },
    }),
    "CoachingContractPresetFunction - Error saving preset",
  );
}
