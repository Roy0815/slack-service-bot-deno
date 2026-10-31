import { SaveNewMemberFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import { assertOk, errorMessage } from "../../../shared/util.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import {
  UserJoiningDetails,
  userJoiningFields,
} from "../../../shared/masterdata/types.ts";

export default SlackFunction(
  SaveNewMemberFunction,
  async ({ inputs, client, env }) => {
    const rawInputs = inputs as unknown as Record<string, string>;
    const newMemberInfo: UserJoiningDetails = {};

    // taken over unchanged, like the legacy step - the webhook already
    // delivers the dates in the format the sheet expects
    for (const key of userJoiningFields) {
      const value = rawInputs[key];
      if (value === undefined) continue;
      // deno-lint-ignore no-explicit-any
      (newMemberInfo as any)[key] = value;
    }

    try {
      // save first so a failed save doesn't leave a contact card behind
      const bankDetails = await getMasterdataService(env).saveNewMember(
        newMemberInfo,
      );
      const contactCardMessageLink = await postContactCard(
        client,
        inputs.adminChannel,
        newMemberInfo,
      );

      if (
        !bankDetails.mandateReference || !bankDetails.initialAmount ||
        !bankDetails.recurringAmount
      ) {
        return {
          error:
            `Mandatsreferenz für ${newMemberInfo.firstname} ${newMemberInfo.lastname} konnte nicht gelesen werden. Das Mitglied wurde gespeichert, bitte die Formeln in "SEPA Daten" prüfen.`,
        };
      }

      return {
        outputs: {
          mandateReference: bankDetails.mandateReference,
          initialAmount: bankDetails.initialAmount,
          recurringAmount: bankDetails.recurringAmount,
          contactCardMessageLink,
        },
      };
    } catch (error) {
      return {
        error: `Fehler beim Speichern des neuen Mitglieds: ${
          errorMessage(error)
        }`,
      };
    }
  },
);

/**
 * Uploads a vCard for the new member to the admin channel via the external
 * upload flow (getUploadURLExternal -> upload -> completeUploadExternal),
 * then resolves the message it was shared in to a permalink (empty if
 * Slack hasn't reported the share yet).
 */
async function postContactCard(
  client: SlackAPIClient,
  channel: string,
  member: UserJoiningDetails,
): Promise<string> {
  const filename = `${member.firstname} ${member.lastname}.vcf`;
  const content = `BEGIN:VCARD
VERSION:3.0
N:${member.lastname};${member.firstname}
EMAIL:${member.email}
TEL;TYPE=voice:${(member.phone ?? "").replace(/\s+/g, "")}
END:VCARD`;
  const contentBytes = new TextEncoder().encode(content);

  const uploadUrlResponse = assertOk(
    await client.apiCall("files.getUploadURLExternal", {
      filename,
      length: contentBytes.length,
    }),
    "SaveNewMemberFunction - Error getting upload URL",
  );

  const uploadResponse = await fetch(uploadUrlResponse.upload_url, {
    method: "POST",
    body: (() => {
      const form = new FormData();
      form.append("file", new Blob([contentBytes]), filename);
      return form;
    })(),
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Kontaktkarten-Upload fehlgeschlagen: ${uploadResponse.statusText}`,
    );
  }

  const completeResponse = assertOk(
    await client.apiCall("files.completeUploadExternal", {
      files: [{
        id: uploadUrlResponse.file_id,
        title: `${member.firstname} ${member.lastname}`,
      }],
      channel_id: channel,
      initial_comment:
        `Slack und WhatsApp einladen: ${member.firstname} ${member.lastname}`,
    }),
    "SaveNewMemberFunction - Error completing upload",
  );

  const fileId = completeResponse.files?.[0]?.id;
  if (!fileId) return "";

  const fileInfo = assertOk(
    await client.files.info({ file: fileId }),
    "SaveNewMemberFunction - Error fetching contact card file info",
  );

  // shares are keyed by visibility - the admin channel may be either
  const shares = {
    ...fileInfo.file?.shares?.public,
    ...fileInfo.file?.shares?.private,
  };
  const ts = shares[channel]?.[0]?.ts;
  if (!ts) return "";

  const permalinkResponse = assertOk(
    await client.chat.getPermalink({ channel, message_ts: ts }),
    "SaveNewMemberFunction - Error fetching contact card permalink",
  );

  return permalinkResponse.permalink ?? "";
}
