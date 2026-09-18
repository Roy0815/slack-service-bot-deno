import { FormatDateFunction } from "./definition.ts";
import { SlackFunction } from "deno-slack-sdk/mod.ts";

/**
 * Formats inputs.date (YYYY-MM-DD) by replacing the YYYY/MM/DD placeholders
 * in inputs.format with the respective date parts.
 */
export default SlackFunction(
  FormatDateFunction,
  ({ inputs }) => {
    const [year, month, day] = inputs.date.split("-");

    return {
      outputs: {
        formattedDate: inputs.format
          .replace(/YYYY/g, year)
          .replace(/MM/g, month)
          .replace(/DD/g, day),
      },
    };
  },
);
