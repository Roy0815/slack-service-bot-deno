import { UploadFileToGoogleDriveFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { SlackAPIClient } from "deno-slack-api/types.ts";
import { assertOk } from "../../../shared/util.ts";
import { getGoogleDriveAccessToken } from "../../lib/google_auth.ts";
import { guessMimeType } from "../../lib/mime_types.ts";

const DRIVE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";

type DownloadedFile = {
  fileBytes: Uint8Array<ArrayBuffer>;
  fileName: string;
  mimeType: string;
};

export default SlackFunction(
  UploadFileToGoogleDriveFunction,
  async ({ inputs, client, env }) => {
    const fileName = inputs.fileDate
      ? `${inputs.fileDate.replace(/-/g, "")} ${inputs.fileName}`
      : inputs.fileName;

    try {
      if (!inputs.file && !inputs.fileURL) {
        throw new Error("Weder 'file' noch 'fileURL' wurde angegeben");
      }

      const downloaded = inputs.fileURL
        ? await downloadPublicFile(inputs.fileURL, fileName)
        : await downloadSlackFile(
          client,
          env,
          inputs.file as string,
          fileName,
        );

      const accessToken = await getGoogleDriveAccessToken(env);

      const { id, webViewLink } = await uploadToDriveFolder(
        accessToken,
        inputs.driveFolderID,
        downloaded,
      );

      return {
        outputs: { driveFileId: id, driveFileURL: webViewLink },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: `Google Drive Upload fehlgeschlagen: ${message}` };
    }
  },
);

async function downloadPublicFile(
  url: string,
  fileName: string,
): Promise<DownloadedFile> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Datei konnte nicht von ${url} geladen werden`);
  }

  return {
    fileBytes: new Uint8Array(await response.arrayBuffer()),
    fileName,
    mimeType: guessMimeType(fileName),
  };
}

async function downloadSlackFile(
  client: SlackAPIClient,
  env: Record<string, string>,
  fileId: string,
  fileName: string,
): Promise<DownloadedFile> {
  const infoResponse = assertOk(
    await client.files.info({ file: fileId }),
    "UploadFileToGoogleDriveFunction - Error fetching Slack file info",
  );

  // deno-lint-ignore no-explicit-any
  const file = infoResponse.file as any;
  const extension = /[^.]*$/.exec(file.name ?? "")?.[0] ?? "";

  const downloadResponse = await fetch(file.url_private_download, {
    headers: { Authorization: `Bearer ${env["SLACK_BOT_TOKEN"]!}` },
  });

  if (!downloadResponse.ok) {
    throw new Error("Datei konnte nicht von Slack geladen werden");
  }

  return {
    fileBytes: new Uint8Array(await downloadResponse.arrayBuffer()),
    fileName: extension ? `${fileName}.${extension}` : fileName,
    mimeType: file.mimetype ?? "application/octet-stream",
  };
}

async function uploadToDriveFolder(
  accessToken: string,
  driveFolderID: string,
  { fileBytes, fileName, mimeType }: DownloadedFile,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = `drive-upload-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [driveFolderID],
  });

  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    fileBytes,
    `\r\n--${boundary}--`,
  ]);

  const response = await fetch(DRIVE_UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Google Drive Upload fehlgeschlagen: ${
        data.error?.message ?? response.statusText
      }`,
    );
  }

  return data;
}
