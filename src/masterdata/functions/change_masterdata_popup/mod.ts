import { ChangeMasterdataPopupFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  ActionIds,
  BlockIds,
  changeMasterdataModal,
  changeMasterdataViewCallbackId,
} from "./views.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import {
  ApprovalObject,
  maintainableFieldNames,
  maintainableFields,
} from "../../../shared/masterdata/types.ts";
import { assertOk } from "../../../shared/util.ts";

const PHONE_PATTERN = /^(\++|0)\d*$/;

export default SlackFunction(
  ChangeMasterdataPopupFunction,
  async ({ inputs, client, env, event }) => {
    const slackId = inputs.interactivity.interactor.id;

    // open immediately with loading placeholders - the trigger_id expires
    // fast, so the masterdata lookup below has to happen after opening
    const openResponse = assertOk(
      await client.views.open({
        trigger_id: inputs.interactivity.interactivity_pointer,
        view: changeMasterdataModal({}, true),
      }),
      "ChangeMasterdataPopupFunction - Error opening popup",
    );

    const userInfo = await getMasterdataService(env).getUserContactCardFromId(
      { slackId },
    );

    if (!userInfo) {
      await client.views.update({
        view_id: openResponse.view.id,
        view: {
          type: "modal",
          title: { type: "plain_text", text: "Stammdaten ändern" },
          close: { type: "plain_text", text: "Schließen" },
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Du bist nicht als Mitglied registriert.",
            },
          }],
        },
      });

      await client.functions.completeError({
        function_execution_id: event.function_execution_id,
        error: `Der User <@${slackId}> ist nicht als Mitglied registriert.`,
      });

      return { completed: false };
    }

    await client.views.update({
      view_id: openResponse.view.id,
      view: changeMasterdataModal(userInfo, false),
    });

    return { completed: false };
  },
).addViewSubmissionHandler(
  changeMasterdataViewCallbackId,
  async ({ view, body, client, env }) => {
    const phoneValue = view.state.values[BlockIds.phone]?.[ActionIds.phone]
      ?.value as string | undefined;

    if (phoneValue && !PHONE_PATTERN.test(phoneValue)) {
      return {
        response_action: "errors",
        errors: {
          [BlockIds.phone]:
            "Bitte die Telefonnummer im korrekten Format eingeben",
        },
      };
    }

    const slackId = body.user.id;
    const userInfo = await getMasterdataService(env).getUserContactCardFromId(
      { slackId },
    );

    const changes: ApprovalObject = { slackId };
    const changedEntries: {
      key: keyof typeof maintainableFieldNames;
      old: string;
      new: string;
    }[] = [];

    for (const key of maintainableFields) {
      const value = view.state.values[BlockIds[key]]?.[ActionIds[key]]
        ?.value as string | undefined;
      if (!value) continue;

      const oldValue = userInfo?.[key] ?? "";
      if (value === oldValue) continue;

      changes[key] = value;
      changedEntries.push({ key, old: oldValue, new: value });
    }

    if (changedEntries.length === 0) {
      return {
        response_action: "errors",
        errors: {
          [BlockIds.firstname]: "Bitte mindestens einen Wert ändern",
        },
      };
    }

    const changesText = changedEntries
      .map((entry) =>
        `\n\`${
          maintainableFieldNames[entry.key]
        }\`: ${entry.old} :arrow_right: ${entry.new}`
      )
      .join("");

    assertOk(
      await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          changes,
          userNotificationText:
            `Deine Stammdatenänderungen wurden zur Freigabe weitergeleitet. Du wirst informiert, sobald sie freigegeben wurden:${changesText}`,
          approverNotificationText:
            `<@${slackId}> möchte folgende Änderungen an den Stammdaten vornehmen:${changesText}`,
        },
      }),
      "ChangeMasterdataPopupFunction - Error completing execution",
    );

    return {};
  },
);
