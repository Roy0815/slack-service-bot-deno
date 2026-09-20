import { SetLeaveDateFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";

export default SlackFunction(
  SetLeaveDateFunction,
  async ({ inputs, env }) => {
    const leaveDateFormatted = inputs.leaveDate.split("-").reverse().join(
      ".",
    );

    try {
      await getMasterdataService(env).saveLeaveDate(
        { slackId: inputs.leaveUser },
        leaveDateFormatted,
      );
    } catch (error) {
      return {
        error: `Fehler beim Speichern des Austrittsdatums: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    return { outputs: {} };
  },
);
