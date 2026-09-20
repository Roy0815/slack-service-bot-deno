import { ApplyMasterdataChangesFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import { ApprovalObject } from "../../../shared/masterdata/types.ts";

export default SlackFunction(
  ApplyMasterdataChangesFunction,
  async ({ inputs, env }) => {
    const changes = inputs.changes as unknown as ApprovalObject;

    try {
      await getMasterdataService(env).saveMasterdataChanges(changes);
    } catch (error) {
      return {
        error: `Fehler beim Speichern der Stammdatenänderungen: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    return { outputs: {} };
  },
);
