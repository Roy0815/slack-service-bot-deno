/**
 * Everything the code knows about the bank details change form template in
 * the signature service. Field, role and metadata names have to match the
 * template and the webhook in the legacy bot exactly - when either
 * changes, this is the one file to touch.
 */

/**
 * Fields the member fills in when signing. Nothing is pre-filled - the
 * legacy bot's webhook reads these from the completed form and hands them
 * to the approval workflow.
 */
export const BankChangeFields = {
  accountOwner: "accountOwner",
  IBAN: "IBAN",
  BIC: "BIC",
  signingDate: "signingDate",
} as const;

/** The only submitter role of the template */
export const BankChangeRole = "Mitglied";

/**
 * Keys of the submitter metadata. The signature service returns it
 * unchanged in its "form completed" webhook, which is how the legacy bot
 * knows which Slack user the signed form belongs to.
 */
export const BankChangeMetadata = {
  slackId: "slackId",
  changeDate: "changeDate",
} as const;
