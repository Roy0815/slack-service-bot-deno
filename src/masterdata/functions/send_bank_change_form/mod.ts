import { SendBankChangeFormFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  BankChangeMetadata,
  BankChangeRole,
} from "../../../signatures/bank_change_form.ts";
import { getSignatureProvider } from "../../../signatures/lib/provider.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import { errorMessage } from "../../../shared/util.ts";

/**
 * Sends the change form. No modal involved, so there is no 3 second limit
 * - and a failure can be told to the member directly instead of only
 * showing up in the workflow's activity log.
 */
export default SlackFunction(
  SendBankChangeFormFunction,
  async ({ inputs, client, env }) => {
    try {
      const user = await getMasterdataService(env).getUserFromId({
        slackId: inputs.user,
      });
      if (!user?.email) {
        throw new Error("Keine E-Mail-Adresse in den Stammdaten");
      }

      const submission = await getSignatureProvider(env).createSubmission({
        templateId: inputs.templateId,
        sendEmail: true,
        recipients: [{
          roleName: BankChangeRole,
          email: user.email,
          values: {},
          metadata: {
            [BankChangeMetadata.slackId]: inputs.user,
            [BankChangeMetadata.changeDate]: inputs.changeDate,
          },
        }],
      });

      return {
        outputs: { submissionId: submission.submissionId, email: user.email },
      };
    } catch (error) {
      // best effort - the step fails either way, the DM only explains it
      await client.chat.postMessage({
        channel: inputs.user,
        text:
          `:warning: Das Formular für deine neuen Kontodaten konnte leider nicht verschickt werden. Bitte versuche es später noch einmal oder wende dich an den Vorstand.\n> ${
            errorMessage(error)
          }`,
      }).catch(() => {});

      return {
        error: `Kontodaten-Formular konnte nicht gesendet werden: ${
          errorMessage(error)
        }`,
      };
    }
  },
);
