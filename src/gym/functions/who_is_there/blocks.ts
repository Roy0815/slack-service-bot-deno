import { ActionIds, BlockIds } from "./constants.ts";
import { formatSlackDate } from "../../../shared/util.ts";

export type WhoIsThereVote = { user_id: string; time: string };

export type WhoIsThereItem = {
  date: string;
  requested_by: string;
  votes: WhoIsThereVote[];
};

/**
 * Assembles the Block Kit blocks for a single date's query
 */
// deno-lint-ignore no-explicit-any
function whoIsThereDateBlocks(item: WhoIsThereItem): any[] {
  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${"`" + formatSlackDate(item.date) + "`"}*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<@${item.requested_by}> will wissen wer am ${
          formatSlackDate(item.date)
        } in der Stätte ist*`,
      },
    },
    {
      type: "section",
      block_id: BlockIds.inputBlock(item.date),
      text: {
        type: "mrkdwn",
        text: `Wann bist du am ${formatSlackDate(item.date)} in der Stätte?`,
      },
      accessory: {
        type: "timepicker",
        initial_time: "17:00",
        placeholder: {
          type: "plain_text",
          text: "Zeit wählen",
          emoji: true,
        },
        action_id: ActionIds.timePicker,
      },
    },
    {
      type: "actions",
      block_id: BlockIds.actionsBlock(item.date),
      elements: [
        {
          type: "button",
          style: "primary",
          text: {
            type: "plain_text",
            text: "Abschicken",
            emoji: true,
          },
          value: "update",
          action_id: ActionIds.submitAvailability,
        },
        {
          type: "button",
          style: "danger",
          text: {
            type: "plain_text",
            text: "Meine Löschen",
            emoji: true,
          },
          value: "delete",
          action_id: ActionIds.deleteMyAvailability,
        },
        {
          type: "overflow",
          options: [
            {
              text: {
                type: "plain_text",
                text: "Ersteller: Abfrage löschen",
                emoji: true,
              },
            },
          ],
          action_id: ActionIds.creatorDeleteMessage,
        },
      ],
    },
  ];

  if (item.votes.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: item.votes.map((vote) => `${vote.time}\t<@${vote.user_id}>`)
            .join("\n"),
        },
      },
      { type: "divider" },
    );
  }

  return blocks;
}

/**
 * Merges the blocks of every active date into a single message (sorted
 * chronologically), since only one "Wer ist da?" message is kept per channel.
 */
export function whoIsThereMergedBlocks(
  items: WhoIsThereItem[],
  // deno-lint-ignore no-explicit-any
): any[] {
  const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date));

  return sortedItems.flatMap((item, index) => {
    const dateBlocks = whoIsThereDateBlocks(item);
    return index === 0 ? dateBlocks : [{ type: "divider" }, ...dateBlocks];
  });
}

/**
 * Fallback text for notifications/screen readers, listing every active date
 */
export function whoIsThereFallbackText(items: WhoIsThereItem[]): string {
  const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date));

  return `Wer ist da? Abfragen für ${
    sortedItems.map((item) => formatSlackDate(item.date)).join(", ")
  }`;
}
