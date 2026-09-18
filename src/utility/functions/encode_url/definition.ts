import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

/**
 * Custom function that URL-encodes an input string via encodeURI.
 */
export const EncodeUrlFunction = DefineFunction({
  callback_id: "utility_encode_url",
  title: "URL kodieren",
  description: "Kodiert eine Zeichenkette für die Verwendung in einer URL",
  source_file: "src/utility/functions/encode_url/mod.ts",
  input_parameters: {
    properties: {
      input: {
        type: Schema.types.string,
        title: "Zeichenkette",
        description: "Die zu kodierende Zeichenkette",
      },
    },
    required: ["input"],
  },
  output_parameters: {
    properties: {
      encodedString: {
        type: Schema.types.string,
        title: "URL-kodierte Zeichenkette",
        description: "Die kodierte Zeichenkette",
      },
    },
    required: ["encodedString"],
  },
});
