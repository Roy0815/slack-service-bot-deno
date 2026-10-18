/** callback_id of the modal - the view handlers are registered on it */
export const ModalCallbackId = "expenses_submit_from_message_modal";

/** callback_id of the info-only modal shown when there is nothing to submit */
export const NoAttachmentsModalCallbackId =
  "expenses_submit_from_message_no_attachments";

/** callback_id of the modal the approver fills in after clicking "Approve" */
export const ApprovalModalCallbackId = "expenses_submit_from_message_approval";

export const ActionIds = {
  attachment: "attachment",
  expenseDate: "expense_date",
  title: "title",
  paymentStatus: "payment_status",
  paypalAccount: "paypal_account",
  approve: "approve",
  paymentMethod: "payment_method",
} as const;

export const BlockIds = {
  attachment: "attachment_block",
  expenseDate: "expense_date_block",
  title: "title_block",
  paymentStatus: "payment_status_block",
  paypalAccount: "paypal_account_block",
  approve: "approve_block",
  paymentMethod: "payment_method_block",
} as const;

/** Options of "Noch offen?" - the label is also what the step outputs */
export const PaymentStatusOptions = [
  "Rechnung ist noch nicht bezahlt",
  "Rechnung wurde privat bezahlt",
  "Rechnung wurde vom Verein bezahlt",
] as const;

/** Options of "Wie wird bezahlt?" - the label is also what the step outputs */
export const PaymentMethodOptions = [
  "Verein überweist direkt",
  "Verein überweist Mitglied per Paypal",
  "Verein überweist Mitglied per Banküberweisung",
] as const;

/** Shape of a Slack message timestamp, e.g. "1792141861.000100" */
export const MessageTsPattern = /^\d+\.\d+$/;

/** Expense dates are taken from the message in the club's time zone */
export const TimeZone = "Europe/Berlin";
