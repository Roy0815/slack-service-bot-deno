import { assertEquals } from "@std/assert";
import {
  approvalMessageBlocks,
  ApproverActionIds,
  resolvedMessageBlocks,
} from "./blocks.ts";

// Schema.slack.types.expanded_rich_text delivers a Block Kit `rich_text`
// block at runtime, not a plain string - this is what `inputs.text` and
// `originalText` actually look like.
const richText = {
  type: "rich_text",
  elements: [
    {
      type: "rich_text_section",
      elements: [{ type: "text", text: "Please approve this" }],
    },
  ],
};

Deno.test("approvalMessageBlocks passes the rich_text block through unchanged and adds both decision buttons", () => {
  const blocks = approvalMessageBlocks(richText);

  assertEquals(blocks[0], richText);

  const actionIds = blocks[1].elements.map(
    (element: { action_id: string }) => element.action_id,
  );
  assertEquals(actionIds, [
    ApproverActionIds.approve,
    ApproverActionIds.reject,
  ]);
});

Deno.test("approvalMessageBlocks adds a linked attachment section when a permalink is given", () => {
  const blocks = approvalMessageBlocks(
    richText,
    "https://slack.com/files/F123",
  );

  assertEquals(
    blocks[1].text.text.includes("https://slack.com/files/F123"),
    true,
  );
  assertEquals(blocks[2].type, "actions");
});

Deno.test("resolvedMessageBlocks marks an approval without a reason line", () => {
  const blocks = resolvedMessageBlocks(richText, undefined, {
    approved: true,
    userId: "U1",
  });

  assertEquals(blocks[0], richText);
  assertEquals(blocks[1].text.text.includes("`freigegeben`"), true);
  assertEquals(blocks[1].text.text.includes("<@U1>"), true);
  assertEquals(blocks[1].text.text.includes("Grund:"), false);
});

Deno.test("resolvedMessageBlocks marks a rejection and includes the reason when given", () => {
  const blocks = resolvedMessageBlocks(richText, undefined, {
    approved: false,
    userId: "U2",
    reason: "Falsche Adresse",
  });

  assertEquals(blocks[1].text.text.includes("`abgelehnt`"), true);
  assertEquals(blocks[1].text.text.includes("Grund: Falsche Adresse"), true);
});

Deno.test("resolvedMessageBlocks omits the reason line for a rejection without one", () => {
  const blocks = resolvedMessageBlocks(richText, undefined, {
    approved: false,
    userId: "U2",
  });

  assertEquals(blocks[1].text.text.includes("Grund:"), false);
});

Deno.test("resolvedMessageBlocks keeps the attachment section after a decision", () => {
  const blocks = resolvedMessageBlocks(
    richText,
    "https://slack.com/files/F123",
    { approved: true, userId: "U1" },
  );

  assertEquals(blocks[0], richText);
  assertEquals(
    blocks[1].text.text.includes("https://slack.com/files/F123"),
    true,
  );
  assertEquals(blocks[2].text.text.includes("`freigegeben`"), true);
});
