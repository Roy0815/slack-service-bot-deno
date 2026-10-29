import type { MasterdataService } from "./types.ts";
import { createGoogleSheetsMasterdataService } from "./google_sheets_service.ts";

/**
 * Single place that wires up the active masterdata backend. Swap Google
 * Sheets for a different system by changing this function's body - callers
 * only ever depend on the MasterdataService interface.
 */
export function getMasterdataService(
  env: Record<string, string>,
): MasterdataService {
  return createGoogleSheetsMasterdataService(
    env,
    env["SPREADSHEET_ID_MASTERDATA"]!,
  );
}
