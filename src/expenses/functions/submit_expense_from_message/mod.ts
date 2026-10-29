import { SubmitExpenseFromMessageFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  ActionIds,
  ApprovalModalCallbackId,
  BlockIds,
  MessageTsPattern,
  ModalCallbackId,
} from "./constants.ts";
import { collectAttachments, messageDate } from "./attachments.ts";
import {
  approvalBlocks,
  approvalText,
  approvalView,
  approvedBlocks,
  ExpenseSubmission,
  expenseView,
  noAttachmentsView,
  parseApprovalContext,
  parseSubmission,
  readExpenseForm,
  readPaymentMethod,
  summaryBlocks,
  ViewState,
} from "./blocks.ts";
import { downloadAttachment, fetchMessage, uploadToThread } from "./slack.ts";
import { assertOk, errorMessage } from "../../../shared/util.ts";
import { NotInChannelError } from "../../../shared/channel_access.ts";

/**
 * Opens the expense form for the files of an existing message, posts the
 * submission to the approver channel and completes once it is approved.
 *
 * The function stays alive (`completed: false`) through the form and until
 * someone clicks "Approve" and submits the payment details - only then do
 * the outputs reach the next step.
 */
export default SlackFunction(
  SubmitExpenseFromMessageFunction,
  async ({ inputs, client }) => {
    const interactor = inputs.interactivity.interactor.id;

    // the input is a free string in Workflow Builder, so a wrongly mapped
    // variable would otherwise only surface as Slack's cryptic "invalid_ts"
    if (!MessageTsPattern.test(inputs.messageTs)) {
      return {
        error:
          `"${inputs.messageTs}" ist kein API-Zeitstempel einer Nachricht (z. B. 1792141861.000100)`,
      };
    }

    try {
      const message = await fetchMessage(
        client,
        inputs.channel,
        inputs.messageTs,
      );
      const attachments = collectAttachments(message);

      if (attachments.length === 0) {
        assertOk(
          await client.views.open({
            interactivity_pointer: inputs.interactivity.interactivity_pointer,
            view: noAttachmentsView(),
          }),
          "SubmitExpenseFromMessageFunction - Error opening modal",
        );
        return { error: "Die Nachricht enthält keinen einreichbaren Anhang" };
      }

      assertOk(
        await client.views.open({
          interactivity_pointer: inputs.interactivity.interactivity_pointer,
          view: expenseView(attachments, messageDate(inputs.messageTs)),
        }),
        "SubmitExpenseFromMessageFunction - Error opening modal",
      );

      // IMPORTANT! Keep the execution open so the modal stays interactive
      return { completed: false };
    } catch (error) {
      if (error instanceof NotInChannelError) {
        await client.chat.postMessage({
          channel: interactor,
          text:
            `Ich kann die Nachricht in <#${inputs.channel}> nicht lesen. Bitte füge mich dem Channel hinzu und versuche es erneut.`,
        });
      }

      return {
        error: `Formular konnte nicht geöffnet werden: ${errorMessage(error)}`,
      };
    }
  },
)
  .addViewSubmissionHandler(
    ModalCallbackId,
    async ({ body, view, client, inputs, token }) => {
      const { input, errors } = readExpenseForm(view.state as ViewState);

      // Keeps the modal open with the message next to the offending input
      if (errors) return { response_action: "errors", errors };

      const executionId = body.function_data.execution_id;
      const submitter = inputs.interactivity.interactor.id;

      try {
        // read again instead of passing the attachments through the modal:
        // private_metadata is too small for the download URLs of a long email
        const message = await fetchMessage(
          client,
          inputs.channel,
          inputs.messageTs,
        );
        const attachment = collectAttachments(message).find((candidate) =>
          candidate.fileId === input.fileId
        );
        if (!attachment) throw new Error("Der Anhang wurde nicht gefunden");

        const fileBytes = await downloadAttachment(client, token, attachment);

        const permalink = await client.chat.getPermalink({
          channel: inputs.channel,
          message_ts: inputs.messageTs,
        });

        const pending = {
          ...input,
          submitter,
          ...(permalink.ok ? { sourceMessageLink: permalink.permalink } : {}),
        };

        // posted without the button first: the button carries the ID of the
        // copy, which only exists once the file is uploaded into the thread
        const approvalMessage = assertOk(
          await client.chat.postMessage({
            channel: inputs.approverChannel,
            text: approvalText(submitter),
            blocks: summaryBlocks(pending),
          }),
          "SubmitExpenseFromMessageFunction - Error posting approval message",
        );

        const approverFileId = await uploadToThread(
          client,
          fileBytes,
          attachment.name,
          inputs.approverChannel,
          approvalMessage.ts,
        );

        // fetched now rather than on approval: the click handler must
        // complete quickly, as the interactivity it hands on expires soon
        const approvalPermalink = assertOk(
          await client.chat.getPermalink({
            channel: inputs.approverChannel,
            message_ts: approvalMessage.ts,
          }),
          "SubmitExpenseFromMessageFunction - Error getting approval link",
        );

        const submission: ExpenseSubmission = {
          ...pending,
          approverFileId,
          approvalMessageLink: approvalPermalink.permalink,
        };

        assertOk(
          await client.chat.update({
            channel: inputs.approverChannel,
            ts: approvalMessage.ts,
            text: approvalText(submitter),
            blocks: approvalBlocks(submission),
          }),
          "SubmitExpenseFromMessageFunction - Error adding approve button",
        );

        // a user ID as channel sends a DM from the bot
        await client.chat.postMessage({
          channel: submitter,
          text:
            `Deine Ausgabe "${input.title}" wurde erfolgreich eingereicht und wartet auf Freigabe.`,
        });
      } catch (error) {
        const message = `Rechnung konnte nicht eingereicht werden: ${
          errorMessage(error)
        }`;

        await client.chat.postEphemeral({
          channel: inputs.channel,
          user: submitter,
          text: message,
        });
        await client.functions.completeError({
          function_execution_id: executionId,
          error: message,
        });
      }
    },
  )
  // Without this the workflow would hang forever when the user just closes
  // the modal instead of submitting it.
  .addViewClosedHandler(ModalCallbackId, async ({ body, client }) => {
    await client.functions.completeError({
      function_execution_id: body.function_data.execution_id,
      error: "Rechnung einreichen abgebrochen",
    });
  })
  // "Approve" only asks for the payment details - the step stays open, so
  // closing that modal leaves the button in place for another try
  .addBlockActionsHandler(
    ActionIds.approve,
    async ({ action, body, client }) => {
      assertOk(
        await client.views.open({
          interactivity_pointer: body.interactivity.interactivity_pointer,
          view: approvalView({
            submission: parseSubmission(action.value),
            channel: body.container.channel_id,
            messageTs: body.container.message_ts,
          }),
        }),
        "SubmitExpenseFromMessageFunction - Error opening approval modal",
      );
    },
  )
  .addViewSubmissionHandler(
    ApprovalModalCallbackId,
    async ({ body, view, client }) => {
      const { submission, channel, messageTs } = parseApprovalContext(
        view.private_metadata ?? "",
      );
      const paymentMethod = readPaymentMethod(view.state as ViewState);
      const approver = body.user.id;

      // completing first means a second approver fails here instead of
      // continuing the workflow twice
      const completed = await client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: {
          fileId: submission.approverFileId,
          expenseDate: submission.expenseDate,
          title: submission.title,
          paymentStatus: submission.paymentStatus,
          paypalAccount: submission.paypalAccount ?? "",
          submitter: submission.submitter,
          approver,
          paymentMethod,
          approvalMessage: { channel_id: channel, message_ts: messageTs },
          approvalMessageLink: submission.approvalMessageLink,
          approvalMessageTs: messageTs,
        },
      });

      if (!completed.ok) {
        return {
          response_action: "errors",
          errors: {
            [BlockIds.paymentMethod]:
              "Die Rechnung wurde bereits freigegeben oder der Workflow ist beendet",
          },
        };
      }

      assertOk(
        await client.chat.update({
          channel,
          ts: messageTs,
          text: approvalText(submission.submitter),
          blocks: approvedBlocks(submission, approver, paymentMethod),
        }),
        "SubmitExpenseFromMessageFunction - Error updating approval message",
      );
    },
  );
