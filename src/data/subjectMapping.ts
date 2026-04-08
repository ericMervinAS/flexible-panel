// ─── Subject mapping ───────────────────────────────────────────────────────────
// Maps image index ranges (0-based) → subject indices (0-based) present in that photo.
// null = not yet mapped — consumers should fall back to showing all subjects.
//
// Photos 1–2   → Subject 4
// Photos 3–18  → Subject 4 + Subject 11
// Photos 19–20 → Subject 1
// Photos 21–27 → Subject 9 + Subject 10

export function getSubjectIndices(imageIndex: number): number[] | null {
  if (imageIndex <= 1) return [3];        // Photos 1–2
  if (imageIndex <= 17) return [3, 10];    // Photos 3–18  (Subject 11 = index 10)
  if (imageIndex <= 19) return [0];        // Photos 19–20
  if (imageIndex <= 26) return [8, 9];     // Photos 21–27
  if (imageIndex <= 36) return [5, 6, 7];
  if (imageIndex <= 46) return [1, 2];
  if (imageIndex <= 52) return [10, 11];
  if (imageIndex <= 58) return [3, 4];
  if (imageIndex <= 64) return [12, 13];
  if (imageIndex <= 71) return [14, 15];
  if (imageIndex <= 78) return [1];
  if (imageIndex <= 84) return [2];
  if (imageIndex <= 97) return [0];
  if (imageIndex <= 104) return [6];
  if (imageIndex <= 112) return [7];
  if (imageIndex <= 120) return [5];
  if (imageIndex <= 128) return [3];
  if (imageIndex <= 132) return [4];
  return null;
}

// ─── Subject gender mapping ────────────────────────────────────────────────────
// Maps subject index → gender category, matching the chip/preset tag values.
// "All Subjects" is not a per-subject value — it selects across all genders.

export type SubjectGender = "Masculine" | "Feminine" | "Elderly" | "Child";

export const subjectGender: Record<number, SubjectGender> = {
  0:  "Child",
  1:  "Elderly",
  2:  "Elderly",
  3:  "Feminine",
  4:  "Masculine",
  5:  "Feminine",
  6:  "Feminine",
  7:  "Feminine",
  8:  "Feminine",
  9:  "Masculine",
  10: "Feminine",
  11: "Masculine",
  12: "Masculine",
  13: "Feminine",
  14: "Masculine",
  15: "Feminine",
};

// ─── Derived photo counts per subject ─────────────────────────────────────────
// Tallied from all mapped ranges above. Subjects absent from the mapping get 0.

export const subjectPhotoCounts: Record<number, number> = {
  0: 15, // Photos 19–20 (2) + 85–97 (13)
  1: 17, // Photos 37–46 (10) + 72–78 (7)
  2: 16, // Photos 37–46 (10) + 79–84 (6)
  3: 32, // Photos 1–2 (2) + 3–18 (16) + 53–58 (6) + 121–128 (8)
  4: 10, // Photos 53–58 (6) + 129–132 (4)
  5: 17, // Photos 28–36 (9) + 113–120 (8)
  6: 16, // Photos 28–36 (9) + 98–104 (7)
  7: 17, // Photos 28–36 (9) + 105–112 (8)
  8: 7,  // Photos 21–27
  9: 7,  // Photos 21–27
  10: 22, // Photos 3–18 (16) + 47–52 (6)
  11: 6,  // Photos 47–52
  12: 6,  // Photos 59–64
  13: 6,  // Photos 59–64
  14: 7,  // Photos 65–71
  15: 7,  // Photos 65–71
};
