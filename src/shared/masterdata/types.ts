export type UserSex = "m" | "w";

export type MembershipType = "aktiv" | "ermäßigt" | "passiv";

export interface UserIds {
  id?: number;
  slackId?: string;
}

export interface User {
  id: number;
  firstname: string;
  lastname: string;
  joinedDate: string;
  leaveDate: string;
  slackId: string;
  birthday: string;
  sex: UserSex;
  email: string;
  phone: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
}

export type UserContactCard = User & { vCardContent?: string };

export interface UserMaintenanceDetails {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  street?: string;
  houseNumber?: string;
  zip?: string;
  city?: string;
}

export type ApprovalObject = UserMaintenanceDetails & { slackId: string };

export const maintainableFields: (keyof UserMaintenanceDetails)[] = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "street",
  "houseNumber",
  "city",
  "zip",
];

export const maintainableFieldNames: Record<
  keyof UserMaintenanceDetails,
  string
> = {
  firstname: "Vorname",
  lastname: "Nachname",
  email: "Email",
  phone: "Telefonnummer",
  street: "Straße",
  houseNumber: "Hausnummer",
  zip: "Postleitzahl",
  city: "Stadt",
};

export interface UserJoiningDetails {
  joinedDate?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  birthday?: string;
  street?: string;
  houseNumber?: string;
  zip?: string;
  city?: string;
  sex?: UserSex;
  membershipType?: MembershipType;
  IBAN?: string;
  BIC?: string;
  accountOwner?: string;
  signingDate?: string;
  docusealFileURL?: string;
}

export const userJoiningFields: (keyof UserJoiningDetails)[] = [
  "joinedDate",
  "firstname",
  "lastname",
  "email",
  "phone",
  "birthday",
  "street",
  "houseNumber",
  "zip",
  "city",
  "sex",
  "membershipType",
  "IBAN",
  "BIC",
  "accountOwner",
  "signingDate",
];

export interface UserJoiningReturn {
  mandateReference: string;
  recurringAmount: string;
  initialAmount: string;
}

/**
 * Backend-agnostic contract for member/masterdata access. The active
 * implementation is selected in service.ts - swapping Google Sheets for a
 * different system means implementing this interface and changing that one
 * file, without touching any callers.
 */
export interface MasterdataService {
  getUserFromId(ids: UserIds): Promise<User | undefined>;
  getUserFromEmail(email: string): Promise<User | undefined>;
  getUserContactCardFromId(
    ids: UserIds,
  ): Promise<UserContactCard | undefined>;
  saveMasterdataChanges(maintObj: ApprovalObject): Promise<void>;
  isUserRegistered(ids: UserIds): Promise<boolean>;
  getAllActiveUsers(): Promise<User[]>;
  saveSlackId(id: number, slackId: string): Promise<void>;
  saveLeaveDate(ids: UserIds, leaveDate: string): Promise<void>;
  saveNewMember(details: UserJoiningDetails): Promise<UserJoiningReturn>;
}
