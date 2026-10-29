import { assertEquals } from "@std/assert";
import {
  approvalBlocks,
  approvalView,
  approvedBlocks,
  ExpenseSubmission,
  expenseView,
  parseApprovalContext,
  parseSubmission,
  readExpenseForm,
  readPaymentMethod,
  ViewState,
} from "./blocks.ts";
import {
  ActionIds,
  BlockIds,
  PaymentMethodOptions,
  PaymentStatusOptions,
} from "./constants.ts";

function filledState(paypal?: string, title = " Trikots "): ViewState {
  return {
    values: {
      [BlockIds.attachment]: {
        [ActionIds.attachment]: { selected_option: { value: "F1" } },
      },
      [BlockIds.expenseDate]: {
        [ActionIds.expenseDate]: { selected_date: "2026-10-16" },
      },
      [BlockIds.title]: { [ActionIds.title]: { value: title } },
      [BlockIds.paymentStatus]: {
        [ActionIds.paymentStatus]: {
          selected_option: { value: PaymentStatusOptions[1] },
        },
      },
      [BlockIds.paypalAccount]: {
        [ActionIds.paypalAccount]: { value: paypal },
      },
    },
  };
}

const submission: ExpenseSubmission = {
  fileId: "F1",
  expenseDate: "2026-10-16",
  title: "Trikots <Größe M>",
  paymentStatus: PaymentStatusOptions[1],
  submitter: "U1",
  approverFileId: "F2",
  approvalMessageLink: "https://example.slack.com/archives/C2/p2",
  sourceMessageLink: "https://example.slack.com/archives/C1/p1",
};

Deno.test("reads a filled form", () => {
  assertEquals(readExpenseForm(filledState("roy@example.com")), {
    input: {
      fileId: "F1",
      expenseDate: "2026-10-16",
      title: "Trikots",
      paymentStatus: PaymentStatusOptions[1],
      paypalAccount: "roy@example.com",
    },
  });
});

Deno.test("an empty paypal account is left out", () => {
  assertEquals(
    readExpenseForm(filledState("  ")).input?.paypalAccount,
    undefined,
  );
});

Deno.test("a blank title is rejected", () => {
  assertEquals(readExpenseForm(filledState(undefined, "   ")), {
    errors: { [BlockIds.title]: "Bitte ausfüllen" },
  });
});

Deno.test("a single attachment is preselected, several are not", () => {
  const select = (count: number) =>
    expenseView(
      Array.from({ length: count }, (_, i) => ({
        fileId: `F${i}`,
        name: `f${i}.pdf`,
      })),
      "2026-10-16",
    ).blocks[0].element;

  assertEquals(select(1).initial_option.value, "F0");
  assertEquals(select(2).initial_option, undefined);
});

Deno.test("long file names are shortened to Slack's option limit", () => {
  const view = expenseView(
    [{ fileId: "F1", name: "x".repeat(100) }],
    "2026-10-16",
  );
  assertEquals(view.blocks[0].element.options[0].text.text.length, 75);
});

Deno.test("the approve button round-trips the submission", () => {
  const button = approvalBlocks(submission).at(-1).elements[0];
  assertEquals(parseSubmission(button.value), submission);
});

Deno.test("user input is escaped and the button is replaced after approval", () => {
  const blocks = approvedBlocks(submission, "U9", PaymentMethodOptions[1]);
  assertEquals(blocks[0].text.text.includes("Trikots &lt;Größe M&gt;"), true);
  assertEquals(blocks[0].text.text.includes("16.10.2026"), true);
  assertEquals(blocks.at(-1).elements[0].text.includes("<@U9>"), true);
  assertEquals(blocks.at(-1).elements[0].text.includes("Paypal"), true);
  assertEquals(blocks.some((block) => block.type === "actions"), false);
});

Deno.test("the approval modal carries the submission and reads the payment method", () => {
  const context = { submission, channel: "C2", messageTs: "2.000100" };
  const view = approvalView(context);

  assertEquals(parseApprovalContext(view.private_metadata), context);
  // Slack's limit for private_metadata
  assertEquals(view.private_metadata.length <= 3000, true);

  assertEquals(
    readPaymentMethod({
      values: {
        [BlockIds.paymentMethod]: {
          [ActionIds.paymentMethod]: {
            selected_option: { value: PaymentMethodOptions[0] },
          },
        },
      },
    }),
    "Verein überweist direkt",
  );
});
