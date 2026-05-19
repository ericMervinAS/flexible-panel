import editorial_style from "@/assets/profile/editorial_style.webp";
import graicard from "@/assets/profile/graicard.jpg";
import matcha from "@/assets/profile/matcha.jpg";
import porta_400 from "@/assets/profile/porta_400.webp";

export const APERTURE_STOPS = ["1.4", "1.8", "2", "2.8", "4", "5.6", "8", "11", "16", "22"];
export const SHUTTER_STOPS = ["30", "60", "125", "250", "300", "500", "1000", "2000", "4000"];
export const ISO_STOPS = ["100", "200", "400", "800", "1600", "3200", "6400"];

export const WB_OPTIONS = [
  "Auto",
  "Daylight",
  "Cloudy",
  "Shade",
  "Tungsten",
  "Fluorescent",
  "Flash",
  "Custom",
] as const;
export const ASPECT_OPTIONS = ["3:2", "1:1", "4:3", "16:9"] as const;
export const FOCUS_OPTIONS = ["AI Focus", "Manual Focus"] as const;
export const SHOOT_OPTIONS = [
  "Single Shot",
  "Continous high speed",
  "Continous low speed",
  "Timer 10 sec",
  "Timer 2 sec",
] as const;

export interface CameraSpec {
  raw: string;
  jpegQualities: string[];
}

export const CAMERA_SPEC_MAP: Array<{ pattern: RegExp; spec: CameraSpec }> = [
  { pattern: /nikon/i, spec: { raw: "NEF", jpegQualities: ["Fine", "Normal", "Basic"] } },
  {
    pattern: /canon.*(eos r\d|eos r$|r\d+.*mark|rebel sl3|eos m\d{2})/i,
    spec: { raw: "CR3", jpegQualities: ["Fine", "Normal"] },
  },
  { pattern: /canon/i, spec: { raw: "CR2", jpegQualities: ["Fine", "Normal"] } },
  {
    pattern: /sony/i,
    spec: { raw: "ARW", jpegQualities: ["Extra Fine", "Fine", "Standard"] },
  },
  { pattern: /fujifilm|fuji x/i, spec: { raw: "RAF", jpegQualities: ["Fine", "Normal"] } },
  {
    pattern: /olympus|om system/i,
    spec: { raw: "ORF", jpegQualities: ["Fine", "Normal", "Basic"] },
  },
  {
    pattern: /panasonic|lumix/i,
    spec: { raw: "RW2", jpegQualities: ["Fine", "Standard"] },
  },
  { pattern: /leica/i, spec: { raw: "DNG", jpegQualities: ["Fine", "Basic"] } },
  {
    pattern: /pentax|ricoh gr/i,
    spec: { raw: "PEF", jpegQualities: ["Fine", "Normal"] },
  },
];

export const DEFAULT_CAMERA_SPEC: CameraSpec = { raw: "RAW", jpegQualities: ["Fine", "Normal"] };

export const getCameraSpec = (cameraName: string): CameraSpec => {
  for (const { pattern, spec } of CAMERA_SPEC_MAP) {
    if (pattern.test(cameraName)) return spec;
  }
  return DEFAULT_CAMERA_SPEC;
};

export const getFormatOptions = ({ raw, jpegQualities }: CameraSpec): string[] => [
  raw,
  ...jpegQualities.map((q) => `JPEG ${q}`),
  ...jpegQualities.map((q) => `${raw} + JPEG ${q}`),
];

export const parseDualFormat = (
  format: string
): { isDual: boolean; rawLabel: string; jpegLabel: string } => {
  if (!format.includes(" + ")) return { isDual: false, rawLabel: format, jpegLabel: "" };
  const idx = format.indexOf(" + ");
  return { isDual: true, rawLabel: format.slice(0, idx), jpegLabel: format.slice(idx + 3) };
};

export const MOCK_DETECTED_CAMERAS = ["Nikon Z6 III", "Canon EOS R6 Mark II"];

export interface ProfileItem {
  name: string;
  format: "JPEG" | "RAW";
  img: string | null;
}

export interface ProfileSectionData {
  group: string;
  profiles: ProfileItem[];
}

export const PROFILE_SECTIONS_DATA: ProfileSectionData[] = [
  {
    group: "Professional AI Profile(s)",
    profiles: [{ name: "Testing", format: "RAW", img: null }],
  },
  {
    group: "Downloaded",
    profiles: [
      { name: "Editorial Style", format: "JPEG", img: editorial_style },
      { name: "Graicard", format: "JPEG", img: graicard },
      { name: "Matcha", format: "JPEG", img: matcha },
      { name: "Porta 400", format: "JPEG", img: porta_400 },
    ],
  },
];

export const ALL_PROFILES_FLAT = PROFILE_SECTIONS_DATA.flatMap((s) => s.profiles);
