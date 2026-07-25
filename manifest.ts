import { Manifest } from "deno-slack-sdk/mod.ts";
import { WhoIsThereFunction } from "./src/gym/functions/who_is_there/definition.ts";
import { WhoIsThereDeleteFunction } from "./src/gym/functions/who_is_there_delete/definition.ts";
import WhoIsThereDatastore from "./src/gym/datastores/who_is_there.ts";

/**
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "Slack Service Bot",
  description: "Schwerathletik Mannheim Service Bot",
  icon: "assets/SAMxDeno.png",
  workflows: [],
  functions: [WhoIsThereFunction, WhoIsThereDeleteFunction],
  outgoingDomains: [],
  datastores: [WhoIsThereDatastore],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
  ],
});
