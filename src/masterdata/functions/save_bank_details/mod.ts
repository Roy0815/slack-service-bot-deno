import { SaveBankDetailsFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  normalizeBic,
  normalizeIban,
  normalizeSigningDate,
} from "./bank_details.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import { errorMessage } from "../../../shared/util.ts";

export default SlackFunction(
  SaveBankDetailsFunction,
  async ({ inputs, env }) => {
    try {
      await getMasterdataService(env).saveBankDetails(
        { slackId: inputs.user },
        {
          IBAN: normalizeIban(inputs.IBAN),
          BIC: normalizeBic(inputs.BIC),
          accountOwner: inputs.accountOwner?.trim() ?? "",
          signingDate: normalizeSigningDate(inputs.signingDate),
        },
      );
    } catch (error) {
      return {
        error: `Fehler beim Speichern der Kontodaten: ${errorMessage(error)}`,
      };
    }

    return { outputs: {} };
  },
);
