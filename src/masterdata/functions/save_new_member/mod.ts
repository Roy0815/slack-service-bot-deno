import { SaveNewMemberFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import { assertOk } from "../../../shared/util.ts";
import { getMasterdataService } from "../../../shared/masterdata/service.ts";
import {
  UserJoiningDetails,
  userJoiningFields,
} from "../../../shared/masterdata/types.ts";

const DATE_FIELDS: (keyof UserJoiningDetails)[] = [
  "joinedDate",
  "birthday",
  "signingDate",
];

function toGermanDate(isoDate: string): string {
  return isoDate.split("-").reverse().join(".");
}

export default SlackFunction(
  SaveNewMemberFunction,
  async ({ inputs, client, env }) => {
    const rawInputs = inputs as unknown as Record<string, string>;
    const newMemberInfo: UserJoiningDetails = {};

    for (const key of userJoiningFields) {
      const value = rawInputs[key];
      if (value === undefined) continue;
      // deno-lint-ignore no-explicit-any
      (newMemberInfo as any)[key] = DATE_FIELDS.includes(key)
        ? toGermanDate(value)
        : value;
    }

    try {
      const [bankDetails, contactCard, teamInfoResponse] = await Promise.all([
        getMasterdataService(env).saveNewMember(newMemberInfo),
        postContactCard(client, inputs.adminChannel, newMemberInfo),
        client.team.info(),
      ]);

      if (
        !bankDetails.mandateReference || !bankDetails.initialAmount ||
        !bankDetails.recurringAmount
      ) {
        return {
          error:
            `Mandatsreferenz für ${newMemberInfo.firstname} ${newMemberInfo.lastname} konnte nicht gelesen werden. Bitte prüfen.`,
        };
      }

      assertOk(
        teamInfoResponse,
        "SaveNewMemberFunction - Error fetching team info",
      );

      const contactCardMessageLink = contactCard.channelId && contactCard.ts
        ? `${teamInfoResponse.team?.url}archives/${contactCard.channelId}/p${
          contactCard.ts.replace(".", "")
        }`
        : "";

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
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  },
);

/**
 * Uploads a vCard for the new member to the admin channel via the external
 * upload flow (getUploadURLExternal -> upload -> completeUploadExternal),
 * then resolves where that message ended up so a link can be built.
 */
async function postContactCard(
  client: SlackAPIClient,
  channel: string,
  member: UserJoiningDetails,
): Promise<{ channelId?: string; ts?: string }> {
  const filename = `${member.firstname} ${member.lastname}.vcf`;
  const content = `BEGIN:VCARD
VERSION:3.0
N:${member.lastname};${member.firstname}
EMAIL:${member.email}
TEL;TYPE=voice:${member.phone ?? ""}
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
  if (!fileId) return {};

  const fileInfo = assertOk(
    await client.files.info({ file: fileId }),
    "SaveNewMemberFunction - Error fetching contact card file info",
  );

  const channelId = Object.keys(fileInfo.file?.shares?.private ?? {})[0];
  const ts = channelId
    ? fileInfo.file?.shares?.private?.[channelId]?.[0]?.ts
    : undefined;

  return { channelId, ts };
}
