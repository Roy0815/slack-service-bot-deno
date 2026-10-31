import { ApplyMasterdataChangesFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import {
  ApprovalObject,
  maintainableFields,
} from "../../../shared/masterdata/types.ts";
import { errorMessage } from "../../../shared/util.ts";

export default SlackFunction(
  ApplyMasterdataChangesFunction,
  async ({ inputs, env }) => {
    // Workflow Builder passes unchanged fields as empty values, which must
    // not overwrite existing data (the popup never produces empty changes)
    const changes: ApprovalObject = { slackId: inputs.slackId };
    for (const key of maintainableFields) {
      const value = inputs[key];
      if (value) changes[key] = value;
    }

    try {
      await getMasterdataService(env).saveMasterdataChanges(changes);
    } catch (error) {
      return {
        error: `Fehler beim Speichern der Stammdatenänderungen: ${
          errorMessage(error)
        }`,
      };
    }

    return { outputs: {} };
  },
);
