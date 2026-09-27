/**
 * Everything the code knows about the coaching contract template in the
 * signature service. Field and role names have to match the template
 * exactly - when the template changes, this is the one file to touch.
 */

/** Field names in the coaching contract template */
export const CoachingFields = {
  firstName: "firstName",
  lastName: "lastName",
  street: "street",
  cityPostalcode: "cityPostalcode",
  coachingStartDate: "coachingStartDate",
  monthlyRate: "monthlyRate",
} as const;

export type CoachingFieldName =
  typeof CoachingFields[keyof typeof CoachingFields];

/**
 * The subset of fields a user can save as their personal preset - their
 * own name and address, which stay the same from contract to contract.
 */
export const PresetFields = [
  CoachingFields.firstName,
  CoachingFields.lastName,
  CoachingFields.street,
  CoachingFields.cityPostalcode,
] as const;

export type PresetFieldName = typeof PresetFields[number];

/**
 * Submitter roles of the template, listed in signing order: the signature
 * service notifies each party only after the previous one has signed.
 */
export const CoachingRoles = {
  coach: "Coach",
  athlete: "Athlet",
  board1: "Vorstand 1",
  board2: "Vorstand 2",
} as const;
