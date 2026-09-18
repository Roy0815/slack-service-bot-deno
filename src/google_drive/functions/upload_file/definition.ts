import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that downloads a Slack file (or a public URL) and uploads
 * it into a Google Drive folder via a service account. Provide either
 * `file` or `fileURL`.
 */
export const UploadFileToGoogleDriveFunction = DefineFunction({
  callback_id: "google_drive_upload_file",
  title: "Datei zu Google Drive hochladen",
  description:
    "Lädt eine Datei von Slack oder einer öffentliche URL in einen Google Drive Ordner hoch",
  source_file: "src/google_drive/functions/upload_file/mod.ts",
  input_parameters: {
    properties: {
      file: {
        type: Schema.slack.types.rich_text,
        description: "In Slack hochgeladene Datei",
      },
      fileURL: {
        type: Schema.types.string,
        description:
          "Alternative zu 'file': öffentlich erreichbare URL der Datei (muss die Dateiendung enthalten)",
      },
      fileName: {
        type: Schema.types.string,
        description:
          "Name, unter dem die Datei in Google Drive gespeichert wird",
      },
      fileDate: {
        type: Schema.slack.types.date,
        description: "Optional: Datum, das dem Dateinamen vorangestellt wird",
      },
      driveFolderID: {
        type: Schema.types.string,
        description: "ID des Google Drive Ordners",
      },
    },
    required: ["fileName", "driveFolderID"],
  },
  output_parameters: {
    properties: {
      driveFileId: {
        type: Schema.types.string,
        description: "ID der hochgeladenen Datei in Google Drive",
      },
      driveFileURL: {
        type: Schema.types.string,
        description: "Link zur hochgeladenen Datei in Google Drive",
      },
    },
    required: ["driveFileId", "driveFileURL"],
  },
});
