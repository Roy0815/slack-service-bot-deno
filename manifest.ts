import { Manifest } from "deno-slack-sdk/mod.ts";
import { FormatDateFunction } from "./src/utility/functions/format_date/definition.ts";
import { EncodeUrlFunction } from "./src/utility/functions/encode_url/definition.ts";

/**
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "Schwerathletik Mannheim Bot",
  description: "Schwerathletik Mannheim Service Bot based on Deno Slack SDK",
  icon: "assets/SAMxDeno.png",
  workflows: [],
  functions: [
    FormatDateFunction,
    EncodeUrlFunction,
  ],
  outgoingDomains: [
    "oauth2.googleapis.com",
    "www.googleapis.com",
    "sheets.googleapis.com",
    "files.slack.com",
    "docuseal.eu",
  ],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
    "files:read",
    "files:write",
    "team:read",
  ],
});
