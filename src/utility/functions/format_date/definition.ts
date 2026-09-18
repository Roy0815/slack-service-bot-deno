import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that formats an ISO date (YYYY-MM-DD) using a format
 * string with YYYY/MM/DD placeholders, e.g. "DD.MM.YYYY".
 */
export const FormatDateFunction = DefineFunction({
  callback_id: "utility_format_date",
  title: "Datum formatieren",
  description:
    "Formatiert ein Datum anhand eines Formatstrings (z. B. DD.MM.YYYY)",
  source_file: "src/utility/functions/format_date/mod.ts",
  input_parameters: {
    properties: {
      date: {
        type: Schema.slack.types.date,
        title: "Datum",
        description: "Das zu formatierende Datum",
      },
      format: {
        type: Schema.types.string,
        title: "Format",
        description: "Formatstring mit DD.MM.YYYY Platzhaltern",
      },
    },
    required: ["date", "format"],
  },
  output_parameters: {
    properties: {
      formattedDate: {
        type: Schema.types.string,
        title: "Formatiertes Datum",
        description: "Das formatierte Datum",
      },
    },
    required: ["formattedDate"],
  },
});
