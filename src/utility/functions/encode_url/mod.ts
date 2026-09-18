import { EncodeUrlFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";

/**
 * URL-encodes inputs.input via encodeURI.
 */
export default SlackFunction(
  EncodeUrlFunction,
  ({ inputs }) => {
    return {
      outputs: {
        encodedString: encodeURI(inputs.input),
      },
    };
  },
);
