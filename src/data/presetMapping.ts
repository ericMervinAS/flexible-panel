// ─── Gender groups ─────────────────────────────────────────────────────────────

export type GenderGroup = "All Subjects" | "Masculine" | "Feminine" | "Elderly" | "Child";

// ─── Section & slider definitions ─────────────────────────────────────────────
// Single source of truth for all slider sections used in Loupe View.
// Order here matches the order they appear in the panel.

export type BadgeType = "new" | "beta" | "improved";

export interface SliderDef {
  name: string;
  badge?: BadgeType;
  /** Tooltip text shown on hover of the badge icon. */
  badgeLabel?: string;
}

export const SECTIONS: { title: string; sliders: SliderDef[] }[] = [
  { title: "Face Spots", sliders: [{ name: "Acne" }, { name: "Freckles" }, { name: "Spots" }] },
  { title: "Wrinkles", sliders: [{ name: "Forehead", badge: "new", badgeLabel: "Just Launched" }, { name: "Smile Lines" }] },
  { title: "Teeth", sliders: [{ name: "Whiten" }, { name: "Brighten" }] },
  { title: "Face", sliders: [{ name: "Brighten" }, { name: "Smoothen", badge: "beta", badgeLabel: "Beta" }, { name: "Remove Shine" }] },
  { title: "Eyes", sliders: [{ name: "Glass Glare" }, { name: "Eye Brighten" }, { name: "Eye Bags", badge: "improved", badgeLabel: "Improved & Better" }] },
  { title: "Hair", sliders: [{ name: "Flyaways" }] },
  { title: "Body", sliders: [{ name: "Smoothen" }, { name: "Blemish" }] },
  { title: "Cloth", sliders: [{ name: "Cloth Dewrinkle" }] },
];

// ─── Preset value shape ────────────────────────────────────────────────────────
// Each key matches a section title; each nested key matches a slider name.
// All values are 0–100.

export interface PresetValues {
  "Face Spots": { Acne: number; Freckles: number; Spots: number };
  Wrinkles: { Forehead: number; "Smile Lines": number };
  Teeth: { Whiten: number; Brighten: number };
  Face: { Brighten: number; Smoothen: number; "Remove Shine": number };
  Eyes: { "Glass Glare": number; "Eye Brighten": number; "Eye Bags": number };
  Hair: { Flyaways: number };
  Body: { Smoothen: number; Blemish: number };
  Cloth: { "Cloth Dewrinkle": number };
}

// ─── Preset ───────────────────────────────────────────────────────────────────

export interface Preset {
  id: string;
  name: string;
  /** Gender groups this preset is designed for — shown as tags in the dropdown. */
  tags: GenderGroup[];
  /** false = Aftershoot built-in preset, true = user-created custom preset. */
  custom: boolean;
  values: PresetValues;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all-zero slider values — used as the initial state in Loupe View. */
export function blankSectionValues(): number[][] {
  return SECTIONS.map(({ sliders }) => sliders.map(() => 0));
}

/**
 * Converts a Preset's values into the number[][] shape consumed by
 * LoupeSubjectPanel's sectionValues state.
 * Any missing slider falls back to 0.
 */
export function presetToSectionValues(preset: Preset): number[][] {
  return SECTIONS.map(({ title, sliders }) =>
    sliders.map(
      ({ name }) => (preset.values as unknown as Record<string, Record<string, number>>)[title]?.[name] ?? 0
    )
  );
}

/** Looks up a preset by name (as stored in the preset state). */
export function findPreset(name: string): Preset | undefined {
  return PRESETS.find((p) => p.name === name);
}

// ─── Preset definitions ────────────────────────────────────────────────────────
// To duplicate a preset: copy any entry, assign a new unique `id` and `name`.
// To create a custom preset: set `custom: true`.
// Values will be filled in — all sliders default to 0 until specified.

export const PRESETS: Preset[] = [

  // ── Custom Presets ────────────────────────────────────────────────────────────

  {
    id: "custom-1",
    name: "Custom Preset 1",
    tags: ["Masculine", "Feminine", "Child"],
    custom: true,
    values: {
      "Face Spots": { Acne: 0, Freckles: 0, Spots: 0 },
      Wrinkles: { Forehead: 0, "Smile Lines": 0 },
      Teeth: { Whiten: 0, Brighten: 0 },
      Face: { Brighten: 0, Smoothen: 0, "Remove Shine": 0 },
      Eyes: { "Glass Glare": 0, "Eye Brighten": 0, "Eye Bags": 0 },
      Hair: { Flyaways: 0 },
      Body: { Smoothen: 0, Blemish: 0 },
      Cloth: { "Cloth Dewrinkle": 0 },
    },
  },

  // ── Aftershoot Presets ─────────────────────────────────────────────────────────

  {
    id: "newborn-shoots",
    name: "Newborn Shoots",
    tags: ["All Subjects"],
    custom: false,
    values: {
      "Face Spots": { Acne: 75, Freckles: 75, Spots: 75 },
      Wrinkles: { Forehead: 0, "Smile Lines": 0 },
      Teeth: { Whiten: 0, Brighten: 0 },
      Face: { Brighten: 50, Smoothen: 35, "Remove Shine": 0 },
      Eyes: { "Glass Glare": 0, "Eye Brighten": 0, "Eye Bags": 0 },
      Hair: { Flyaways: 0 },
      Body: { Smoothen: 50, Blemish: 50 },
      Cloth: { "Cloth Dewrinkle": 0 },
    },
  },

  {
    id: "student-portraits",
    name: "Student Portraits",
    tags: ["All Subjects"],
    custom: false,
    values: {
      "Face Spots": { Acne: 75, Freckles: 75, Spots: 75 },
      Wrinkles: { Forehead: 0, "Smile Lines": 0 },
      Teeth: { Whiten: 25, Brighten: 50 },
      Face: { Brighten: 50, Smoothen: 0, "Remove Shine": 0 },
      Eyes: { "Glass Glare": 75, "Eye Brighten": 50, "Eye Bags": 0 },
      Hair: { Flyaways: 100 },
      Body: { Smoothen: 0, Blemish: 0 },
      Cloth: { "Cloth Dewrinkle": 0 },
    },
  },

  {
    id: "face-pop",
    name: "Face Pop",
    tags: ["All Subjects"],
    custom: false,
    values: {
      "Face Spots": { Acne: 0, Freckles: 0, Spots: 0 },
      Wrinkles: { Forehead: 0, "Smile Lines": 0 },
      Teeth: { Whiten: 25, Brighten: 50 },
      Face: { Brighten: 50, Smoothen: 0, "Remove Shine": 0 },
      Eyes: { "Glass Glare": 0, "Eye Brighten": 75, "Eye Bags": 0 },
      Hair: { Flyaways: 0 },
      Body: { Smoothen: 0, Blemish: 0 },
      Cloth: { "Cloth Dewrinkle": 0 },
    },
  },

  {
    id: "anti-aging",
    name: "Anti Aging",
    tags: ["All Subjects"],
    custom: false,
    values: {
      "Face Spots": { Acne: 25, Freckles: 0, Spots: 25 },
      Wrinkles: { Forehead: 100, "Smile Lines": 100 },
      Teeth: { Whiten: 0, Brighten: 50 },
      Face: { Brighten: 0, Smoothen: 35, "Remove Shine": 0 },
      Eyes: { "Glass Glare": 0, "Eye Brighten": 0, "Eye Bags": 65 },
      Hair: { Flyaways: 0 },
      Body: { Smoothen: 0, Blemish: 0 },
      Cloth: { "Cloth Dewrinkle": 0 },
    },
  },

  {
    id: "face-clean-up",
    name: "Face Clean Up",
    tags: ["All Subjects"],
    custom: false,
    values: {
      "Face Spots": { Acne: 75, Freckles: 75, Spots: 75 },
      Wrinkles: { Forehead: 0, "Smile Lines": 0 },
      Teeth: { Whiten: 0, Brighten: 0 },
      Face: { Brighten: 15, Smoothen: 15, "Remove Shine": 0 },
      Eyes: { "Glass Glare": 0, "Eye Brighten": 0, "Eye Bags": 0 },
      Hair: { Flyaways: 0 },
      Body: { Smoothen: 0, Blemish: 0 },
      Cloth: { "Cloth Dewrinkle": 0 },
    },
  },

  {
    id: "wedding-radiance",
    name: "Wedding Radiance",
    tags: ["All Subjects"],
    custom: false,
    values: {
      "Face Spots": { Acne: 50, Freckles: 25, Spots: 50 },
      Wrinkles: { Forehead: 0, "Smile Lines": 0 },
      Teeth: { Whiten: 0, Brighten: 50 },
      Face: { Brighten: 50, Smoothen: 35, "Remove Shine": 0 },
      Eyes: { "Glass Glare": 0, "Eye Brighten": 50, "Eye Bags": 65 },
      Hair: { Flyaways: 100 },
      Body: { Smoothen: 0, Blemish: 0 },
      Cloth: { "Cloth Dewrinkle": 0 },
    },
  },

];
