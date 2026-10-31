import { ApproverFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import {
  approvalMessageBlocks,
  ApproverActionIds,
  rejectionNotificationBlocks,
  resolvedMessageBlocks,
} from "./blocks.ts";
import {
  ActionIds,
  BlockIds,
  rejectReasonModal,
  rejectReasonViewCallbackId,
} from "./views.ts";
import { assertOk, errorMessage } from "../../util.ts";

/** The approval message; `threadTs` is set when it is a thread reply */
type MessageLocation = { channel: string; ts: string; threadTs?: string };

const ALREADY_DECIDED =
  "Über diese Anfrage wurde bereits von jemand anderem entschieden";

export default SlackFunction(
  ApproverFunction,
  async ({ inputs, client }) => {
    // an uncaught error only surfaces as "event_dispatch_failed" in the
    // workflow, so return it as the step's error instead
    try {
      const threadTs = threadTsFromLink(
        inputs.threadMessageLink,
        inputs.approverChannel,
      );

      const posted = assertOk(
        await client.chat.postMessage({
          channel: inputs.approverChannel,
          // as a reply below e.g. a message with a file, which the bot
          // could not link itself if it was uploaded in a workflow form
          ...(threadTs ? { thread_ts: threadTs, reply_broadcast: true } : {}),
          blocks: approvalMessageBlocks(inputs.text),
          text: "Neue Genehmigungsanfrage",
        }),
        "ApproverFunction - Error posting approval message",
      );

      // fetched now rather than on approval: the click must complete the
      // step quickly, as the interactivity it hands on expires within
      // seconds
      const location = {
        channel: inputs.approverChannel,
        ts: posted.ts as string,
      };
      const messageLink = await getPermalink(client, location);
      if (messageLink) {
        assertOk(
          await client.chat.update({
            ...location,
            blocks: approvalMessageBlocks(inputs.text, messageLink),
            text: "Neue Genehmigungsanfrage",
          }),
          "ApproverFunction - Error adding approval link",
        );
      }
    } catch (error) {
      return { error: errorMessage(error) };
    }

    // keep the execution open until the approver decides
    return { completed: false };
  },
).addBlockActionsHandler(
  [ApproverActionIds.approve, ApproverActionIds.reject],
  async ({ action, body, client }) => {
    if (action.action_id === ApproverActionIds.reject) {
      assertOk(
        await client.views.open({
          // body.trigger_id is the function's trigger ("Ft…"), which
          // views.open rejects with invalid_arguments
          interactivity_pointer: body.interactivity.interactivity_pointer,
          view: rejectReasonModal(
            JSON.stringify(
              {
                channel: body.container.channel_id,
                ts: body.container.message_ts,
                threadTs: threadTsFromLink(
                  body.function_data.inputs.threadMessageLink,
                  body.container.channel_id,
                ),
              } satisfies MessageLocation,
            ),
          ),
        }),
        "ApproverFunction - Error opening reject-reason popup",
      );
      return;
    }

    const decided = await resolveApproval(client, {
      location: {
        channel: body.container.channel_id,
        ts: body.container.message_ts,
        threadTs: threadTsFromLink(
          body.function_data.inputs.threadMessageLink,
          body.container.channel_id,
        ),
      },
      originalText: body.function_data.inputs.text,
      requester: body.function_data.inputs.requester,
      executionId: body.function_data.execution_id,
      approved: true,
      userId: body.user.id,
      messageLink: action.value ?? "",
      interactivity: body.interactivity,
    });

    if (!decided) {
      await client.chat.postEphemeral({
        channel: body.container.channel_id,
        user: body.user.id,
        text: ALREADY_DECIDED,
      });
    }
  },
).addViewSubmissionHandler(
  rejectReasonViewCallbackId,
  async ({ view, body, client }) => {
    const location = JSON.parse(
      view.private_metadata ?? "{}",
    ) as MessageLocation;
    const reason = view.state.values[BlockIds.reason]?.[ActionIds.reason]
      ?.value as string | undefined;

    const decided = await resolveApproval(client, {
      location,
      originalText: body.function_data.inputs.text,
      requester: body.function_data.inputs.requester,
      executionId: body.function_data.execution_id,
      approved: false,
      userId: body.user.id,
      reason,
    });

    if (!decided) {
      return {
        response_action: "errors",
        errors: { [BlockIds.reason]: ALREADY_DECIDED },
      };
    }

    return {};
  },
);

/**
 * Completes the step first: Slack only accepts the first completion of an
 * execution, so that call decides between concurrent clicks. Only the
 * winner goes on to notify and update the message - returns false for
 * everyone else, without side effects.
 */
async function resolveApproval(
  client: SlackAPIClient,
  {
    location,
    originalText,
    requester,
    executionId,
    approved,
    userId,
    reason,
    messageLink,
    interactivity,
  }: {
    location: MessageLocation;
    // deno-lint-ignore no-explicit-any
    originalText: any;
    requester?: string;
    executionId: string;
    approved: boolean;
    userId: string;
    reason?: string;
    /** approval only: link stored in the Freigeben button */
    messageLink?: string;
    /** approval only: the click, handed on to the next step */
    // deno-lint-ignore no-explicit-any
    interactivity?: any;
  },
): Promise<boolean> {
  // ending with an error is what stops the remaining workflow steps
  const completed = approved
    ? await client.functions.completeSuccess({
      function_execution_id: executionId,
      outputs: {
        approver: userId,
        approvalMessage: {
          channel_id: location.channel,
          message_ts: location.ts,
        },
        approvalMessageLink: messageLink ?? "",
        approvalMessageTs: location.ts,
        interactivity,
      },
    })
    : await client.functions.completeError({
      function_execution_id: executionId,
      error: `Anfrage abgelehnt von <@${userId}>${
        reason ? `. Grund: ${reason}` : ""
      }`,
    });

  if (!completed.ok) {
    console.log(
      `ApproverFunction - already decided, ignoring <@${userId}>: ${completed.error}`,
    );
    return false;
  }

  if (!approved && requester) {
    await notifyRequester(client, {
      requester,
      location,
      originalText,
      userId,
      reason,
    });
  }

  assertOk(
    await client.chat.update({
      channel: location.channel,
      ts: location.ts,
      blocks: resolvedMessageBlocks(originalText, {
        approved,
        userId,
        reason,
      }),
      text: "Genehmigungsanfrage aktualisiert",
    }),
    "ApproverFunction - Error updating approval message",
  );

  return true;
}

/**
 * Link to the approval message for the step's outputs. Empty if Slack
 * can't resolve it - a missing link must not block the approval.
 */
async function getPermalink(
  client: SlackAPIClient,
  location: MessageLocation,
): Promise<string> {
  const response = await client.chat.getPermalink({
    channel: location.channel,
    message_ts: location.ts,
  });
  if (!response.ok) {
    console.error(
      `ApproverFunction - Error getting approval link: ${response.error}`,
    );
  }
  return response.permalink ?? "";
}

/**
 * DMs the requester about a rejection. Never throws: if the DM can't be
 * delivered, a note is posted in the approval message's thread and
 * broadcast to the channel, so nobody misses that the requester still has
 * to be told in person.
 */
async function notifyRequester(
  client: SlackAPIClient,
  { requester, location, originalText, userId, reason }: {
    requester: string;
    location: MessageLocation;
    // deno-lint-ignore no-explicit-any
    originalText: any;
    userId: string;
    reason?: string;
  },
): Promise<void> {
  try {
    assertOk(
      await client.chat.postMessage({
        channel: requester,
        blocks: rejectionNotificationBlocks(originalText, { userId, reason }),
        text: "Deine Anfrage wurde abgelehnt",
      }),
      "ApproverFunction - Error notifying requester",
    );
    return;
  } catch (error) {
    console.error(errorMessage(error));
  }

  try {
    assertOk(
      await client.chat.postMessage({
        channel: location.channel,
        // a thread reply can't have a thread of its own
        thread_ts: location.threadTs ?? location.ts,
        reply_broadcast: true,
        text:
          `:warning: Die DM an <@${requester}> über die Ablehnung konnte nicht zugestellt werden. Bitte persönlich informieren.`,
      }),
      "ApproverFunction - Error posting DM failure note",
    );
  } catch (error) {
    console.error(errorMessage(error));
  }
}

/**
 * Reads the message timestamp from a message link
 * (`…/archives/C123/p1793448876123456` → `1793448876.123456`). Workflow
 * Builder only hands out the timestamp variable rounded to whole seconds,
 * which matches no message - Slack would then silently post to the channel
 * instead of into the thread.
 */
export function threadTsFromLink(
  link: string | undefined,
  channel: string,
): string | undefined {
  if (!link) return undefined;

  const match = /\/archives\/([^/]+)\/p(\d{10})(\d{6})/.exec(link);
  if (!match) {
    throw new Error(`„${link}“ ist kein Link zu einer Slack-Nachricht`);
  }

  const [, linkChannel, seconds, micros] = match;
  if (linkChannel !== channel) {
    throw new Error(
      "Die Thread-Nachricht muss im Freigabe-Channel gepostet sein",
    );
  }

  return `${seconds}.${micros}`;
}
