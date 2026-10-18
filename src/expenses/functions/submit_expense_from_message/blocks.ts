import {
  ActionIds,
  ApprovalModalCallbackId,
  BlockIds,
  ModalCallbackId,
  NoAttachmentsModalCallbackId,
  PaymentMethodOptions,
  PaymentStatusOptions,
} from "./constants.ts";
import { MessageAttachment } from "./attachments.ts";
import { BlockKitObject } from "../../../shared/block_kit.ts";
import { formatSlackDate } from "../../../shared/util.ts";

/** Everything a submitted form yields */
export type ExpenseFormInput = {
  fileId: string;
  expenseDate: string;
  title: string;
  paymentStatus: string;
  paypalAccount?: string;
};

/** The submission as carried in the approve button until it is clicked */
export type ExpenseSubmission = ExpenseFormInput & {
  submitter: string;
  /** The re-uploaded copy in the approver channel's thread */
  approverFileId: string;
  approvalMessageLink: string;
  sourceMessageLink?: string;
};

/** Carried through the approval modal's private_metadata */
export type ApprovalContext = {
  submission: ExpenseSubmission;
  /** Where the approval message with the button lives */
  channel: string;
  messageTs: string;
};

/**
 * The shape of `view.state` - Block Kit state is a
 * `{ [block_id]: { [action_id]: element } }` map whose element type depends
 * on the element that produced it.
 */
export type ViewState = {
  values?: Record<string, Record<string, BlockKitObject>>;
};

/** Slack's limit for the text of a select option */
const OptionTextMaxLength = 75;

// --- Modals ----------------------------------------------------------------

export function expenseView(
  attachments: MessageAttachment[],
  initialDate: string,
): BlockKitObject {
  const attachmentOptions = attachments.map((attachment) =>
    plainOption(attachment.name, attachment.fileId)
  );
  const paymentOptions = PaymentStatusOptions.map((status) =>
    plainOption(status, status)
  );

  return {
    type: "modal",
    callback_id: ModalCallbackId,
    // required for addViewClosedHandler to fire when the user hits "Abbrechen"
    notify_on_close: true,
    title: { type: "plain_text", text: "Rechnung einreichen" },
    submit: { type: "plain_text", text: "Einreichen" },
    close: { type: "plain_text", text: "Abbrechen" },
    blocks: [
      {
        type: "input",
        block_id: BlockIds.attachment,
        label: { type: "plain_text", text: "Rechnung" },
        element: {
          type: "static_select",
          action_id: ActionIds.attachment,
          placeholder: { type: "plain_text", text: "Anhang wählen" },
          options: attachmentOptions,
          // nothing to choose from - saves the user a click
          ...(attachmentOptions.length === 1
            ? { initial_option: attachmentOptions[0] }
            : {}),
        },
      },
      {
        type: "input",
        block_id: BlockIds.expenseDate,
        label: { type: "plain_text", text: "Datum der Ausgabe" },
        element: {
          type: "datepicker",
          action_id: ActionIds.expenseDate,
          initial_date: initialDate,
        },
      },
      {
        type: "input",
        block_id: BlockIds.title,
        label: { type: "plain_text", text: "Titel der Ausgabe" },
        element: {
          type: "plain_text_input",
          action_id: ActionIds.title,
          max_length: 200,
        },
      },
      {
        type: "input",
        block_id: BlockIds.paymentStatus,
        label: { type: "plain_text", text: "Noch offen?" },
        element: {
          type: "static_select",
          action_id: ActionIds.paymentStatus,
          placeholder: { type: "plain_text", text: "Status wählen" },
          options: paymentOptions,
        },
      },
      {
        type: "input",
        block_id: BlockIds.paypalAccount,
        optional: true,
        label: { type: "plain_text", text: "Paypal Konto" },
        element: {
          type: "plain_text_input",
          action_id: ActionIds.paypalAccount,
          max_length: 150,
        },
      },
    ],
  };
}

/** Shown instead of the form when the message has no submittable file */
export function noAttachmentsView(): BlockKitObject {
  return {
    type: "modal",
    callback_id: NoAttachmentsModalCallbackId,
    title: { type: "plain_text", text: "Rechnung einreichen" },
    close: { type: "plain_text", text: "Schließen" },
    blocks: [{
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "Diese Nachricht enthält keinen Anhang, der als Rechnung eingereicht werden kann. Bei E-Mails zählen nur die Anhänge der E-Mail, nicht die E-Mail selbst.",
      },
    }],
  };
}

/**
 * Opened by "Approve". Closing it does nothing, so the button stays and the
 * approval can be started again - only submitting completes the step.
 */
export function approvalView(context: ApprovalContext): BlockKitObject {
  return {
    type: "modal",
    callback_id: ApprovalModalCallbackId,
    private_metadata: JSON.stringify(context),
    title: { type: "plain_text", text: "Angaben zur Bezahlung" },
    submit: { type: "plain_text", text: "Freigeben" },
    close: { type: "plain_text", text: "Abbrechen" },
    blocks: [{
      type: "input",
      block_id: BlockIds.paymentMethod,
      label: { type: "plain_text", text: "Wie wird bezahlt?" },
      element: {
        type: "static_select",
        action_id: ActionIds.paymentMethod,
        placeholder: { type: "plain_text", text: "Zahlungsart wählen" },
        options: PaymentMethodOptions.map((method) =>
          plainOption(method, method)
        ),
      },
    }],
  };
}

function plainOption(text: string, value: string): BlockKitObject {
  return {
    text: {
      type: "plain_text",
      text: text.length > OptionTextMaxLength
        ? `${text.slice(0, OptionTextMaxLength - 1)}…`
        : text,
    },
    value,
  };
}

// --- Reading the submitted state -------------------------------------------

/**
 * Turns the submitted view state into the form's values. Slack already
 * enforces the required inputs; the only check left is a title that is
 * more than whitespace.
 */
export function readExpenseForm(
  state: ViewState,
): { input: ExpenseFormInput; errors?: undefined } | {
  input?: undefined;
  errors: Record<string, string>;
} {
  const values = state.values ?? {};

  const title = values[BlockIds.title]?.[ActionIds.title]?.value?.trim();
  if (!title) return { errors: { [BlockIds.title]: "Bitte ausfüllen" } };

  const paypalAccount = values[BlockIds.paypalAccount]
    ?.[ActionIds.paypalAccount]?.value?.trim() || undefined;

  return {
    input: {
      fileId: values[BlockIds.attachment]?.[ActionIds.attachment]
        ?.selected_option?.value,
      expenseDate: values[BlockIds.expenseDate]?.[ActionIds.expenseDate]
        ?.selected_date,
      title,
      paymentStatus: values[BlockIds.paymentStatus]?.[ActionIds.paymentStatus]
        ?.selected_option?.value,
      ...(paypalAccount ? { paypalAccount } : {}),
    },
  };
}

/** Slack enforces the select as required, so it is always set on submit */
export function readPaymentMethod(state: ViewState): string {
  return state.values?.[BlockIds.paymentMethod]?.[ActionIds.paymentMethod]
    ?.selected_option?.value;
}

export function parseApprovalContext(metadata: string): ApprovalContext {
  return JSON.parse(metadata) as ApprovalContext;
}

// --- Approval message ------------------------------------------------------

export function approvalText(submitter: string): string {
  return `<@${submitter}> hat eine neue Rechnung eingereicht`;
}

/**
 * The message in the approver channel. The approve button carries the whole
 * submission, so the click handler can complete the step without any
 * storage of its own.
 */
export function approvalBlocks(
  submission: ExpenseSubmission,
): BlockKitObject[] {
  return [
    ...summaryBlocks(submission),
    {
      type: "actions",
      block_id: BlockIds.approve,
      elements: [{
        type: "button",
        action_id: ActionIds.approve,
        style: "primary",
        text: { type: "plain_text", text: "Approve" },
        value: JSON.stringify(submission),
      }],
    },
  ];
}

/** The approval message after the click - same summary, button replaced */
export function approvedBlocks(
  submission: ExpenseSubmission,
  approver: string,
  paymentMethod: string,
): BlockKitObject[] {
  return [
    ...summaryBlocks(submission),
    {
      type: "context",
      elements: [{
        type: "mrkdwn",
        text:
          `:white_check_mark: Freigegeben von <@${approver}> · ${paymentMethod}`,
      }],
    },
  ];
}

/**
 * Posted on its own first (the file is then uploaded into its thread), so
 * it must make sense without the button too.
 */
export function summaryBlocks(
  submission: Omit<
    ExpenseSubmission,
    "approverFileId" | "approvalMessageLink"
  >,
): BlockKitObject[] {
  const lines = [
    `${approvalText(submission.submitter)}:`,
    "",
    "*Datum der Ausgabe*",
    formatSlackDate(submission.expenseDate),
    "*Titel der Ausgabe*",
    escapeMrkdwn(submission.title),
    "*Noch offen?*",
    submission.paymentStatus,
    "*Paypal Konto*",
    submission.paypalAccount ? escapeMrkdwn(submission.paypalAccount) : "-",
  ];

  return [
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
    ...(submission.sourceMessageLink
      ? [{
        type: "context",
        elements: [{
          type: "mrkdwn",
          text:
            `<${submission.sourceMessageLink}|Originalnachricht> · Rechnung im Thread`,
        }],
      }]
      : []),
  ];
}

export function parseSubmission(value: string): ExpenseSubmission {
  return JSON.parse(value) as ExpenseSubmission;
}

/** User input must not turn into links, mentions or formatting by accident */
function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
    />/g,
    "&gt;",
  );
}
