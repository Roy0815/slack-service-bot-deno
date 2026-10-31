import { assertEquals } from "@std/assert";
import {
  approvalMessageBlocks,
  ApproverActionIds,
  rejectionNotificationBlocks,
  resolvedMessageBlocks,
  richTextToMrkdwn,
  toRichTextBlocks,
} from "./blocks.ts";

// Schema.slack.types.expanded_rich_text delivers an array with a block of
// type `expanded_rich_text` at runtime, not a plain string - this is what
// `inputs.text` and `originalText` actually look like.
const richText = [{
  type: "expanded_rich_text",
  elements: [
    {
      type: "rich_text_section",
      elements: [{ type: "text", text: "Please approve this" }],
    },
  ],
}];

// what chat.postMessage accepts
const postedRichText = { ...richText[0], type: "rich_text" };

Deno.test("approvalMessageBlocks converts the text to a rich_text block and adds both decision buttons", () => {
  const blocks = approvalMessageBlocks(richText);

  assertEquals(blocks[0], postedRichText);

  const actionIds = blocks[1].elements.map(
    (element: { action_id: string }) => element.action_id,
  );
  assertEquals(actionIds, [
    ApproverActionIds.approve,
    ApproverActionIds.reject,
  ]);
});

Deno.test("resolvedMessageBlocks marks an approval without a reason line", () => {
  const blocks = resolvedMessageBlocks(richText, {
    approved: true,
    userId: "U1",
  });

  assertEquals(blocks[0], postedRichText);
  assertEquals(
    blocks[1].elements[0].text.includes(":white_check_mark: `freigegeben`"),
    true,
  );
  assertEquals(blocks[1].elements[0].text.includes("<@U1>"), true);
  assertEquals(blocks[1].elements[0].text.includes("Grund:"), false);
});

Deno.test("resolvedMessageBlocks marks a rejection and includes the reason when given", () => {
  const blocks = resolvedMessageBlocks(richText, {
    approved: false,
    userId: "U2",
    reason: "Falsche Adresse",
  });

  assertEquals(blocks[1].elements[0].text.includes(":x: `abgelehnt`"), true);
  assertEquals(
    blocks[1].elements[0].text.includes("Grund: Falsche Adresse"),
    true,
  );
});

Deno.test("resolvedMessageBlocks omits the reason line for a rejection without one", () => {
  const blocks = resolvedMessageBlocks(richText, {
    approved: false,
    userId: "U2",
  });

  assertEquals(blocks[1].elements[0].text.includes("Grund:"), false);
});

Deno.test("toRichTextBlocks turns mrkdwn mentions and inline code from inserted variables into rich text elements", () => {
  const [block] = toRichTextBlocks([{
    type: "expanded_rich_text",
    elements: [{
      type: "rich_text_section",
      elements: [
        {
          type: "text",
          text: "<@U1> in <#C1|general>:\n`Vorname`: Roy ",
        },
        { type: "emoji", name: "arrow_right" },
        { type: "text", text: " Robert", style: { bold: true } },
      ],
    }],
  }]);

  assertEquals(block, {
    type: "rich_text",
    elements: [{
      type: "rich_text_section",
      elements: [
        { type: "user", user_id: "U1" },
        { type: "text", text: " in " },
        { type: "channel", channel_id: "C1" },
        { type: "text", text: ":\n" },
        { type: "text", text: "Vorname", style: { code: true } },
        { type: "text", text: ": Roy " },
        { type: "emoji", name: "arrow_right" },
        { type: "text", text: " Robert", style: { bold: true } },
      ],
    }],
  });
});

Deno.test("toRichTextBlocks converts text inside nested containers like lists", () => {
  const [block] = toRichTextBlocks({
    type: "rich_text",
    elements: [{
      type: "rich_text_list",
      style: "bullet",
      elements: [{
        type: "rich_text_section",
        elements: [{ type: "text", text: "by <@U2>" }],
      }],
    }],
  });

  assertEquals(block.elements[0].elements[0].elements, [
    { type: "text", text: "by " },
    { type: "user", user_id: "U2" },
  ]);
});

Deno.test("rejectionNotificationBlocks shows the original request as mrkdwn in a context block", () => {
  const blocks = rejectionNotificationBlocks(richText, {
    userId: "U_APPROVER",
    reason: "Not now",
  });

  assertEquals(blocks[1], {
    type: "context",
    elements: [{ type: "mrkdwn", text: "Please approve this" }],
  });
});

Deno.test("richTextToMrkdwn renders the Workflow Builder notification text", () => {
  // as logged from a real run: a variable with mrkdwn, emoji parsed by Slack
  const text = [{
    type: "expanded_rich_text",
    elements: [{
      type: "rich_text_section",
      elements: [
        {
          type: "text",
          text: "<@U1> möchte folgende Änderungen vornehmen:\n`Vorname`: Roy ",
        },
        { type: "emoji", name: "arrow_right" },
        { type: "text", text: " Robert" },
      ],
    }],
  }];

  assertEquals(
    richTextToMrkdwn(text),
    "<@U1> möchte folgende Änderungen vornehmen:\n`Vorname`: Roy :arrow_right: Robert",
  );
});

Deno.test("richTextToMrkdwn renders styles, links, lists, quotes and code blocks", () => {
  const text = {
    type: "rich_text",
    elements: [
      {
        type: "rich_text_section",
        elements: [
          { type: "text", text: "Bitte " },
          { type: "text", text: "dringend ", style: { bold: true } },
          { type: "text", text: "a<b & c>d", style: { italic: true } },
          { type: "text", text: " " },
          { type: "link", url: "https://example.org", text: "Beleg" },
          { type: "text", text: "\n" },
        ],
      },
      {
        type: "rich_text_list",
        style: "bullet",
        elements: [
          {
            type: "rich_text_section",
            elements: [{ type: "text", text: "eins" }],
          },
          {
            type: "rich_text_section",
            elements: [{ type: "text", text: "zwei" }],
          },
        ],
      },
      {
        type: "rich_text_list",
        style: "ordered",
        indent: 1,
        elements: [{
          type: "rich_text_section",
          elements: [{ type: "text", text: "unterpunkt" }],
        }],
      },
      {
        type: "rich_text_quote",
        elements: [{ type: "text", text: "zitat\nzeile 2" }],
      },
      {
        type: "rich_text_preformatted",
        elements: [{ type: "text", text: "code" }],
      },
    ],
  };

  assertEquals(
    richTextToMrkdwn(text),
    [
      "Bitte *dringend* _a&lt;b &amp; c&gt;d_ <https://example.org|Beleg>",
      "• eins",
      "• zwei",
      "    1. unterpunkt",
      "> zitat",
      "> zeile 2",
      "```code```",
    ].join("\n"),
  );
});
