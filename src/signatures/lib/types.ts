/**
 * Provider-agnostic signature service types.
 *
 * Nothing in here may reference a concrete provider (DocuSeal, ...).
 * The functions under src/signatures/functions only ever import this file
 * and provider.ts, so swapping the provider stays confined to
 * src/signatures/lib/.
 */

/**
 * A single pre-filled document value. Number fields want a number and
 * checkboxes a boolean - flattening those to strings would send the wrong
 * thing to the signature service.
 */
export type SignatureValue = string | number | boolean | string[];

export type SignatureRecipient = {
  /** Must match a submitter role of the template exactly */
  roleName: string;
  email: string;
  name?: string;
  /** Pre-filled values for this party's fields, keyed by field name */
  values: Record<string, SignatureValue>;
};

export type CreateSubmissionInput = {
  templateId: string;
  /** Whether the service emails the signature request to the recipients */
  sendEmail: boolean;
  /** In signing order - the service notifies the parties one after another */
  recipients: SignatureRecipient[];
};

export type CreatedSubmission = {
  submissionId: string;
  recipients: {
    role: string;
    email: string;
    name?: string;
    signingUrl: string;
  }[];
};

export interface SignatureProvider {
  /** Shown in error messages so admins can tell which service failed */
  readonly providerName: string;
  createSubmission(input: CreateSubmissionInput): Promise<CreatedSubmission>;
}
