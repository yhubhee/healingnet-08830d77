// Design tokens from the approved mockup. Light and dark must have the same keys
// (checked by a unit test).

export const light = {
  background: "#FBFAF7",
  card: "#FFFFFF",
  surface: "#F4EFE6",
  border: "#E6E0D6",
  divider: "#EFEAE1",
  text: "#112A2F",
  textMuted: "#55676B",
  primary: "#186E6A",
  onPrimary: "#FFFFFF",
  primaryText: "#186E6A",
  primarySoft: "#E3F1EF",
  hero: "#186E6A",
  onHero: "#FFFFFF",
  onHeroMuted: "#D5ECEA",
  coral: "#EE6C4D",
  onCoral: "#112A2F",
  coralSoft: "#FDE9E3",
  successBg: "#E2F3EC",
  successText: "#0A6B4C",
  warningBg: "#FDF0DD",
  warningText: "#8A4504",
  danger: "#B91E1E",
  dangerSoft: "#FBE9E9",
  tabBar: "#FFFFFF",
  skeleton: "#EFEAE1",
  overlay: "rgba(17, 42, 47, 0.45)",
} as const;

export type Colors = { [K in keyof typeof light]: string };

export const dark: Colors = {
  background: "#0F1C1F",
  card: "#172A2E",
  surface: "#1C3135",
  border: "#2A4045",
  divider: "#233A3E",
  text: "#E8EFEF",
  textMuted: "#9FB3B6",
  primary: "#1E7F79",
  onPrimary: "#FFFFFF",
  primaryText: "#7ED3CD",
  primarySoft: "#173F3E",
  hero: "#14504D",
  onHero: "#FFFFFF",
  onHeroMuted: "#C5E3E0",
  coral: "#F08A6E",
  onCoral: "#0F1C1F",
  coralSoft: "#3D2620",
  successBg: "#12392D",
  successText: "#7FD9B3",
  warningBg: "#3D2C10",
  warningText: "#F2C17D",
  danger: "#F28B82",
  dangerSoft: "#3A1F1F",
  tabBar: "#132428",
  skeleton: "#233A3E",
  overlay: "rgba(0, 0, 0, 0.6)",
};

export const palettes = { light, dark } as const;
export type Scheme = keyof typeof palettes;
export type ThemeChoice = "system" | Scheme;

export const radius = { card: 22, button: 14, input: 14, chip: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** Smallest touch target, in density-independent pixels. */
export const MIN_TOUCH = 48;

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  /** Screen titles only. */
  title: "Fraunces_600SemiBold",
  mono: "monospace",
} as const;

/** The prescription QR always sits on white, in dark mode too. */
export const QR_BACKGROUND = "#FFFFFF";
export const QR_FOREGROUND = "#000000";

export function resolveScheme(choice: ThemeChoice, system: string | null | undefined): Scheme {
  if (choice === "light" || choice === "dark") return choice;
  return system === "dark" ? "dark" : "light";
}
