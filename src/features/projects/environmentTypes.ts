export const ENVIRONMENT_TYPES = ["Development", "Test", "Staging", "Production", "Custom"] as const;

export type EnvironmentType = (typeof ENVIRONMENT_TYPES)[number];

/** Splits a comma-separated field into trimmed, non-empty values. */
export function toList(text: string): string[] {
  return text.split(",").map((value) => value.trim()).filter(Boolean);
}

export function isFullUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "";
  } catch {
    return false;
  }
}

/** The host of a base URL, which is what the workspace scope lists. */
export function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host.toLowerCase();
  } catch {
    return "";
  }
}
