import { Manifest } from "deno-slack-sdk/mod.ts";
import { FormatDateFunction } from "./src/utility/functions/format_date/definition.ts";
import { EncodeUrlFunction } from "./src/utility/functions/encode_url/definition.ts";
import { UploadFileToGoogleDriveFunction } from "./src/google_drive/functions/upload_file/definition.ts";
import { CoachingContractPresetFunction } from "./src/signatures/functions/coaching_contract_preset/definition.ts";
import { SendCoachingRequestFunction } from "./src/signatures/functions/send_coaching_request/definition.ts";
import CoachingPresetsDatastore from "./src/signatures/datastores/coaching_presets.ts";

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
    UploadFileToGoogleDriveFunction,
    CoachingContractPresetFunction,
    SendCoachingRequestFunction,
  ],
  datastores: [CoachingPresetsDatastore],
  outgoingDomains: [
    "oauth2.googleapis.com",
    "www.googleapis.com",
    "sheets.googleapis.com",
    "files.slack.com",
    "docuseal.eu",
    // Both DocuSeal API regions, so switching region only needs
    // DOCUSEAL_API_URL changed - no redeploy of the manifest.
    "api.docuseal.eu",
    "api.docuseal.com",
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
