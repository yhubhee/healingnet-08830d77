// Query keys for everything that belongs to one person. Every key carries the patient id
// (the signed-in patient's, or a family member's), so two people's data can never share a
// cache entry, on screen or in what is saved to the phone.

type Id = string | null | undefined;
const id = (patientId: Id) => patientId ?? null;

export const personKeys = {
  appointments: (patientId: Id) => ["appointments", id(patientId)] as const,
  visitReviews: (patientId: Id) => ["visit-reviews", id(patientId)] as const,
  rxDocuments: (patientId: Id) => ["rx-documents", id(patientId)] as const,
  rxRequests: (patientId: Id) => ["rx-requests", id(patientId)] as const,
  labResults: (patientId: Id) => ["lab-results", id(patientId)] as const,
  emr: (patientId: Id) => ["emr", id(patientId)] as const,
  letters: (patientId: Id) => ["letters", id(patientId)] as const,
  letterDoctors: (patientId: Id) => ["letter-doctors", id(patientId)] as const,
  /** A family member's profile row. The signed-in patient's own row is ["profile", userId]. */
  memberProfile: (userId: Id, patientId: Id) => ["profile", userId ?? "none", id(patientId)] as const,
} as const;

/** The family list and each member's next visit belong to the account, not to one person. */
export const familyKey = (userId: Id) => ["family", userId ?? "none"] as const;
export const familyNextKey = (userId: Id) => ["family-next", userId ?? "none"] as const;
