import { SetLeaveDateFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import { errorMessage, formatSlackDate } from "../../../shared/util.ts";

export default SlackFunction(
  SetLeaveDateFunction,
  async ({ inputs, env }) => {
    try {
      await getMasterdataService(env).saveLeaveDate(
        { slackId: inputs.leaveUser },
        formatSlackDate(inputs.leaveDate),
      );
    } catch (error) {
      return {
        error: `Fehler beim Speichern des Austrittsdatums: ${
          errorMessage(error)
        }`,
      };
    }

    return { outputs: {} };
  },
);
