import { ApproverFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import {
  approvalMessageBlocks,
  ApproverActionIds,
  resolvedMessageBlocks,
} from "./blocks.ts";
import {
  ActionIds,
  BlockIds,
  rejectReasonModal,
  rejectReasonViewCallbackId,
} from "./views.ts";
import { assertOk } from "../../util.ts";

type MessageLocation = { channel: string; ts: string };

export default SlackFunction(
  ApproverFunction,
  async ({ inputs, client }) => {
    const attachmentPermalink = await getAttachmentPermalink(
      client,
      inputs.attachment as string | undefined,
    );

    assertOk(
      await client.chat.postMessage({
        channel: inputs.approverChannel,
        blocks: approvalMessageBlocks(inputs.text, attachmentPermalink),
        text: "Neue Genehmigungsanfrage",
      }),
      "ApproverFunction - Error posting approval message",
    );

    // keep the execution open until the approver decides
    return { completed: false };
  },
).addBlockActionsHandler(
  [ApproverActionIds.approve, ApproverActionIds.reject],
  async ({ action, body, client }) => {
    if (action.action_id === ApproverActionIds.reject) {
      assertOk(
        await client.views.open({
          trigger_id: body.trigger_id,
          view: rejectReasonModal(
            JSON.stringify(
              {
                channel: body.container.channel_id,
                ts: body.container.message_ts,
              } satisfies MessageLocation,
            ),
          ),
        }),
        "ApproverFunction - Error opening reject-reason popup",
      );
      return;
    }

    await resolveApproval(client, {
      location: {
        channel: body.container.channel_id,
        ts: body.container.message_ts,
      },
      originalText: body.function_data.inputs.text,
      attachmentFileId: body.function_data.inputs.attachment,
      executionId: body.function_data.execution_id,
      approved: true,
      userId: body.user.id,
    });
  },
).addViewSubmissionHandler(
  rejectReasonViewCallbackId,
  async ({ view, body, client }) => {
    const location = JSON.parse(
      view.private_metadata ?? "{}",
    ) as MessageLocation;
    const reason = view.state.values[BlockIds.reason]?.[ActionIds.reason]
      ?.value as string | undefined;

    await resolveApproval(client, {
      location,
      originalText: body.function_data.inputs.text,
      attachmentFileId: body.function_data.inputs.attachment,
      executionId: body.function_data.execution_id,
      approved: false,
      userId: body.user.id,
      reason,
    });

    return {};
  },
);

async function resolveApproval(
  client: SlackAPIClient,
  {
    location,
    originalText,
    attachmentFileId,
    executionId,
    approved,
    userId,
    reason,
  }: {
    location: MessageLocation;
    // deno-lint-ignore no-explicit-any
    originalText: any;
    attachmentFileId?: string;
    executionId: string;
    approved: boolean;
    userId: string;
    reason?: string;
  },
): Promise<void> {
  const attachmentPermalink = await getAttachmentPermalink(
    client,
    attachmentFileId,
  );

  assertOk(
    await client.chat.update({
      channel: location.channel,
      ts: location.ts,
      blocks: resolvedMessageBlocks(originalText, attachmentPermalink, {
        approved,
        userId,
        reason,
      }),
      text: "Genehmigungsanfrage aktualisiert",
    }),
    "ApproverFunction - Error updating approval message",
  );

  assertOk(
    await client.functions.completeSuccess({
      function_execution_id: executionId,
      outputs: { approved, ...(reason ? { reason } : {}) },
    }),
    "ApproverFunction - Error completing execution",
  );
}

/**
 * Reads the file ID handed in via the `attachment` input and resolves it to
 * a permalink so it can be linked from the approval message (Slack unfurls
 * it into a file preview).
 */
async function getAttachmentPermalink(
  client: SlackAPIClient,
  fileId: string | undefined,
): Promise<string | undefined> {
  if (!fileId) return undefined;

  console.log(`Resolving attachment file ID ${fileId} to permalink`);

  const { file } = assertOk(
    await client.files.info({ file: fileId }),
    "ApproverFunction - Error fetching attachment file info",
  );

  // deno-lint-ignore no-explicit-any
  return (file as any)?.permalink;
}
