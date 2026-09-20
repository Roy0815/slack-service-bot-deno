import { Manifest } from "deno-slack-sdk/mod.ts";
// import { WhoIsThereFunction } from "./src/gym/functions/who_is_there/definition.ts";
// import { WhoIsThereStartFunction } from "./src/gym/functions/who_is_there_start/definition.ts";
// import { WhoIsThereDeleteFunction } from "./src/gym/functions/who_is_there_delete/definition.ts";
// import WhoIsThereDatastore from "./src/gym/datastores/who_is_there.ts";
import { FormatDateFunction } from "./src/utility/functions/format_date/definition.ts";
import { EncodeUrlFunction } from "./src/utility/functions/encode_url/definition.ts";
// import { UploadFileToGoogleDriveFunction } from "./src/google_drive/functions/upload_file/definition.ts";
// import { SaveNewMemberFunction } from "./src/masterdata/functions/save_new_member/definition.ts";
// import { SetLeaveDateFunction } from "./src/masterdata/functions/set_leave_date/definition.ts";
// import { ChangeMasterdataPopupFunction } from "./src/masterdata/functions/change_masterdata_popup/definition.ts";
// import { ApplyMasterdataChangesFunction } from "./src/masterdata/functions/apply_masterdata_changes/definition.ts";
// import { ApproverFunction } from "./src/shared/functions/approver/definition.ts";

/**
 * https://api.slack.com/automation/manifest
 */
export default Manifest({
  name: "Schwerathletik Mannheim Service Bot",
  description: "Schwerathletik Mannheim Service Bot based on Deno Slack SDK",
  icon: "assets/SAMxDeno.png",
  workflows: [],
  functions: [
    // WhoIsThereFunction,
    // WhoIsThereStartFunction,
    // WhoIsThereDeleteFunction,
    FormatDateFunction,
    EncodeUrlFunction,
    // UploadFileToGoogleDriveFunction,
    // SaveNewMemberFunction,
    // SetLeaveDateFunction,
    // ChangeMasterdataPopupFunction,
    // ApplyMasterdataChangesFunction,
    // ApproverFunction,
  ],
  outgoingDomains: [
    "oauth2.googleapis.com",
    "www.googleapis.com",
    "sheets.googleapis.com",
    "files.slack.com",
    "docuseal.eu",
  ],
  // datastores: [WhoIsThereDatastore],
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
