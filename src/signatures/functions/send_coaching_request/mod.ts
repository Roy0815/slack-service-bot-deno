import { SendCoachingRequestFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { buildRecipients, parseDocumentValues } from "./recipients.ts";
import { getSignatureProvider } from "../../lib/provider.ts";
import { errorMessage } from "../../../shared/util.ts";

/**
 * Creates the coaching contract signature request. No modal, no
 * interactivity - just one call to the signature service.
 */
export default SlackFunction(
  SendCoachingRequestFunction,
  async ({ inputs, env }) => {
    try {
      const submission = await getSignatureProvider(env).createSubmission({
        templateId: inputs.templateId,
        // an unset boolean in the workflow arrives as undefined -> default on
        sendEmail: inputs.sendEmail !== false,
        recipients: buildRecipients(
          parseDocumentValues(inputs.documentValues),
          inputs,
        ),
      });

      return {
        outputs: {
          submissionId: submission.submissionId,
          recipientEmails: submission.recipients
            .map(({ email }) => email)
            .join(", "),
          signingLinks: submission.recipients
            .map(({ role, name, email, signingUrl }) =>
              `${name || email} (${role}): ${signingUrl}`
            )
            .join("\n"),
        },
      };
    } catch (error) {
      return {
        error: `Signaturanfrage fehlgeschlagen: ${errorMessage(error)}`,
      };
    }
  },
);
