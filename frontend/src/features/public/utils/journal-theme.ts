import type { CSSProperties } from "react";

import type { JournalInfo } from "../types";

const DEFAULT_PRIMARY_COLOR = "#17324d";

type JournalThemeStyle = CSSProperties & Record<`--${string}`, string>;

function normalizeHexColor(value: string | undefined) {
  if (value && /^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }

  return DEFAULT_PRIMARY_COLOR;
}

function toLinearColorChannel(value: number) {
  const normalized = value / 255;

  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getReadableForeground(hexColor: string) {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);

  const luminance =
    0.2126 * toLinearColorChannel(red) +
    0.7152 * toLinearColorChannel(green) +
    0.0722 * toLinearColorChannel(blue);

  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;

  return whiteContrast >= darkContrast ? "#ffffff" : "#0b1220";
}

export function getJournalTheme(
  journal: JournalInfo | null,
): JournalThemeStyle {
  const primaryColor = normalizeHexColor(journal?.primaryColor);
  const primaryForeground = getReadableForeground(primaryColor);

  return {
    "--primary": primaryColor,
    "--primary-foreground": primaryForeground,
    "--brand-primary": primaryColor,
    "--sidebar": primaryColor,
    "--sidebar-foreground": primaryForeground,
    "--sidebar-primary": primaryForeground,
    "--sidebar-primary-foreground": primaryColor,
    "--sidebar-accent": `color-mix(in srgb, ${primaryForeground} 14%, ${primaryColor})`,
    "--sidebar-accent-foreground": primaryForeground,
    "--sidebar-border": `color-mix(in srgb, ${primaryForeground} 22%, ${primaryColor})`,
    "--sidebar-ring": primaryForeground,
  };
}
