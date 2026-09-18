import { getGoogleAccessToken } from "../../shared/google_service_account.ts";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/drive.file",
];

export function getGoogleDriveAccessToken(
  env: Record<string, string>,
): Promise<string> {
  return getGoogleAccessToken(env, SCOPES);
}
