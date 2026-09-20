import { getGoogleAccessToken } from "../google_service_account.ts";
import type {
  ApprovalObject,
  MasterdataService,
  User,
  UserContactCard,
  UserIds,
  UserJoiningDetails,
  UserJoiningReturn,
} from "./types.ts";

const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

const allgDatenSheetName = "Allg Daten";
const bankDatenSheetName = "SEPA Daten";

const allgDatenColumns = {
  id: 1,
  firstname: 2,
  lastname: 3,
  joinedDate: 4,
  leaveDate: 5,
  membershipType: 6,
  birthday: 7,
  sex: 9,
  email: 10,
  street: 11,
  houseNumber: 12,
  zip: 13,
  city: 14,
  phone: 15,
  slackId: 16,
} as const;

const bankDatenColumns = {
  IBAN: 4,
  BIC: 5,
  recurringAmount: 6,
  mandateReference: 8,
  signingDate: 9,
  accountOwner: 10,
  initialAmount: 11,
} as const;

export function convertNumberToColumn(num: number): string {
  let column = "";
  while (num >= 0) {
    column = ("ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(num % 26) - 1] ?? "") + column;
    num = Math.floor(num / 26) - 1;
  }
  return column;
}

export function parseGermanDate(dateString: string): Date {
  const [day, month, year] = dateString.split(".");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatGermanDate(date: Date): string {
  const [datePart] = date.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
  }).split(", ");
  const [day, month, year] = datePart.split(".");
  return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
}

function moveUserLineToObject(userLine: string[]): User {
  return {
    id: Number(userLine[allgDatenColumns.id - 1]),
    firstname: userLine[allgDatenColumns.firstname - 1] ?? "",
    lastname: userLine[allgDatenColumns.lastname - 1] ?? "",
    joinedDate: userLine[allgDatenColumns.joinedDate - 1] ?? "",
    leaveDate: userLine[allgDatenColumns.leaveDate - 1] ?? "",
    birthday: userLine[allgDatenColumns.birthday - 1] ?? "",
    sex: (userLine[allgDatenColumns.sex - 1] ?? "") as User["sex"],
    email: userLine[allgDatenColumns.email - 1] ?? "",
    phone: userLine[allgDatenColumns.phone - 1] ?? "",
    slackId: userLine[allgDatenColumns.slackId - 1] ?? "",
    street: userLine[allgDatenColumns.street - 1] ?? "",
    houseNumber: userLine[allgDatenColumns.houseNumber - 1] ?? "",
    zip: userLine[allgDatenColumns.zip - 1] ?? "",
    city: userLine[allgDatenColumns.city - 1] ?? "",
  };
}

/**
 * Thin Sheets v4 REST client (only the two operations the masterdata
 * service needs), caching the access token for its ~1h lifetime instead of
 * re-authenticating on every single cell read/write.
 */
class SheetsClient {
  #env: Record<string, string>;
  #cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(env: Record<string, string>) {
    this.#env = env;
  }

  async #accessToken(): Promise<string> {
    if (this.#cachedToken && this.#cachedToken.expiresAt > Date.now()) {
      return this.#cachedToken.token;
    }

    const token = await getGoogleAccessToken(this.#env, SHEETS_SCOPES);
    this.#cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
    return token;
  }

  async getCells(spreadsheetId: string, range: string): Promise<string[][]> {
    const accessToken = await this.#accessToken();

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Google Sheets Abfrage fehlgeschlagen: ${
          data.error?.message ?? response.statusText
        }`,
      );
    }

    return data.values ?? [];
  }

  async updateCell(
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ): Promise<void> {
    const accessToken = await this.#accessToken();

    const response = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/${
        encodeURIComponent(range)
      }?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ range, values }),
      },
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(
        `Google Sheets Update fehlgeschlagen: ${
          data.error?.message ?? response.statusText
        }`,
      );
    }
  }
}

/**
 * Google-Sheets-backed implementation of MasterdataService. The spreadsheet
 * has two sheets: "Allg Daten" (general member data) and "SEPA Daten" (bank
 * details); `id` is the row's index in "Allg Daten" including the header
 * row (so id 1 is the first real member row).
 */
export function createGoogleSheetsMasterdataService(
  env: Record<string, string>,
  spreadsheetId: string,
): MasterdataService {
  const sheets = new SheetsClient(env);

  async function getUserFromId(
    { id, slackId }: UserIds,
  ): Promise<User | undefined> {
    if (!id && !slackId) return undefined;

    const data = await sheets.getCells(spreadsheetId, allgDatenSheetName);
    if (!data) return undefined;

    if (id && data.length > id) {
      return moveUserLineToObject(data[id]!);
    }

    if (!slackId) return undefined;

    const user = data.find(
      (row) => row[allgDatenColumns.slackId - 1] === slackId,
    );
    if (!user) return undefined;

    return moveUserLineToObject(user);
  }

  async function getUserFromEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;

    const data = await sheets.getCells(spreadsheetId, allgDatenSheetName);
    if (!data) return undefined;

    const user = data.find(
      (row) => row[allgDatenColumns.email - 1] === email,
    );
    if (!user) return undefined;

    return moveUserLineToObject(user);
  }

  async function getUserContactCardFromId(
    { id, slackId }: UserIds,
  ): Promise<UserContactCard | undefined> {
    if (!id && !slackId) return undefined;

    const data = await sheets.getCells(spreadsheetId, allgDatenSheetName);
    if (!data) return undefined;

    const user = id
      ? data[id]
      : data.find((row) => row[allgDatenColumns.slackId - 1] === slackId);
    if (!user) return undefined;

    return moveUserLineToObject(user);
  }

  async function saveMasterdataChanges(
    maintObj: ApprovalObject,
  ): Promise<void> {
    const user = await getUserFromId({ slackId: maintObj.slackId });
    if (!user) return;

    // prevent Sheets from interpreting a leading "+" as the start of a formula
    if (maintObj.phone && /^\+\d+$/.test(maintObj.phone)) {
      maintObj.phone = `'${maintObj.phone}`;
    }

    const updatedFields = (
      Object.keys(maintObj) as (keyof ApprovalObject)[]
    ).filter((key) => key !== "slackId" || maintObj[key] !== "");

    await Promise.all(
      updatedFields.map((key) =>
        sheets.updateCell(
          spreadsheetId,
          `'${allgDatenSheetName}'!${
            convertNumberToColumn(
              allgDatenColumns[key as keyof typeof allgDatenColumns],
            )
          }${user.id + 1}`,
          [[maintObj[key]]],
        )
      ),
    );
  }

  async function isUserRegistered(ids: UserIds): Promise<boolean> {
    return !!(await getUserFromId(ids));
  }

  async function getAllActiveUsers(): Promise<User[]> {
    const array = await sheets.getCells(spreadsheetId, allgDatenSheetName);
    if (!array) return [];

    array.shift(); // header line

    const activeUsers: User[] = [];
    const today = new Date();
    const todayFormatted = formatGermanDate(today);

    for (const line of array) {
      const user = moveUserLineToObject(line);

      if (!user.firstname && !user.lastname) continue;

      if (!user.leaveDate) {
        activeUsers.push(user);
        continue;
      }

      if (
        parseGermanDate(user.leaveDate) > today ||
        user.leaveDate === todayFormatted
      ) {
        activeUsers.push(user);
      }
    }

    return activeUsers;
  }

  async function saveSlackId(id: number, slackId: string): Promise<void> {
    await sheets.updateCell(
      spreadsheetId,
      `'${allgDatenSheetName}'!${
        convertNumberToColumn(allgDatenColumns.slackId)
      }${id + 1}`,
      [[slackId]],
    );
  }

  async function saveLeaveDate(
    ids: UserIds,
    leaveDate: string,
  ): Promise<void> {
    let id = ids.id;
    if (!id) {
      const user = await getUserFromId({ slackId: ids.slackId });
      if (!user) return;
      id = user.id;
    }

    await sheets.updateCell(
      spreadsheetId,
      `'${allgDatenSheetName}'!${
        convertNumberToColumn(allgDatenColumns.leaveDate)
      }${id + 1}`,
      [[leaveDate]],
    );
  }

  async function saveNewMember(
    userJoiningDetails: UserJoiningDetails,
  ): Promise<UserJoiningReturn> {
    const details = { ...userJoiningDetails };

    // clear account owner if it's just the member's own name
    if (details.accountOwner === `${details.firstname} ${details.lastname}`) {
      details.accountOwner = "";
    }

    // strip spaces and escape a leading "+" so Sheets doesn't read it as a formula
    details.phone = (details.phone ?? "").replace(/\s+/g, "").replace(
      /^\+/,
      "'+",
    );

    const idColumn = convertNumberToColumn(allgDatenColumns.id);
    const ids = await sheets.getCells(
      spreadsheetId,
      `${allgDatenSheetName}!${idColumn}:${idColumn}`,
    );
    const newIdx = ids.filter((line) => line[0]).length + 1;

    const updates: Promise<void>[] = [];

    for (const key of Object.keys(details) as (keyof UserJoiningDetails)[]) {
      const allgCol = allgDatenColumns[key as keyof typeof allgDatenColumns];
      const bankCol = bankDatenColumns[key as keyof typeof bankDatenColumns];
      if (!allgCol && !bankCol) continue;

      const sheetName = allgCol ? allgDatenSheetName : bankDatenSheetName;
      const column = convertNumberToColumn((allgCol ?? bankCol)!);

      updates.push(
        sheets.updateCell(spreadsheetId, `'${sheetName}'!${column}${newIdx}`, [
          [details[key]],
        ]),
      );
    }

    await Promise.all(updates);

    const fields = (await sheets.getCells(
      spreadsheetId,
      `${bankDatenSheetName}!A${newIdx}:${
        convertNumberToColumn(bankDatenColumns.initialAmount)
      }${newIdx}`,
    ))[0] ?? [];

    return {
      mandateReference: fields[bankDatenColumns.mandateReference - 1] ?? "",
      recurringAmount: fields[bankDatenColumns.recurringAmount - 1] ?? "",
      initialAmount: fields[bankDatenColumns.initialAmount - 1] ?? "",
    };
  }

  return {
    getUserFromId,
    getUserFromEmail,
    getUserContactCardFromId,
    saveMasterdataChanges,
    isUserRegistered,
    getAllActiveUsers,
    saveSlackId,
    saveLeaveDate,
    saveNewMember,
  };
}
