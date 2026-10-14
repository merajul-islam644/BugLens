export type ScopeInput = {
  allowedHosts: string[];
  allowedPaths: string[];
  url: string | undefined;
};

export type ScopeResult = { host: string; message: string; ok: boolean; path: string };

function hostMatches(host: string, allowed: string): boolean {
  const clean = allowed.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return host === clean || host.endsWith(`.${clean}`);
}

function pathMatches(path: string, pattern: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (trimmed === "/*" || trimmed === "*") return true;
  if (trimmed.endsWith("/*")) return path === trimmed.slice(0, -2) || path.startsWith(trimmed.slice(0, -1));
  if (trimmed.endsWith("*")) return path.startsWith(trimmed.slice(0, -1));
  return path === trimmed || path.startsWith(`${trimmed}/`);
}

/**
 * PR-03 / IN-01 — the Target URL is checked against the workspace's permission
 * list before anything starts. Nothing runs from inside BugLens either way.
 */
export function checkScope(input: ScopeInput): ScopeResult {
  const raw = (input.url ?? "").trim();
  if (!raw) return { host: "", message: "Enter a full web address, for example https://staging.example.com/profile.", ok: false, path: "" };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { host: "", message: "Enter a full web address, for example https://staging.example.com/profile.", ok: false, path: "" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { host: parsed.host, message: "Enter a full web address, for example https://staging.example.com/profile.", ok: false, path: parsed.pathname };
  }

  const host = parsed.hostname.toLowerCase();
  const hosts = input.allowedHosts.filter((value) => value.trim());
  if (hosts.length > 0 && !hosts.some((allowed) => hostMatches(host, allowed))) {
    return { host, message: "This host is outside your authorized scope.", ok: false, path: parsed.pathname };
  }
  if (hosts.length === 0) {
    return { host, message: "This host is outside your authorized scope.", ok: false, path: parsed.pathname };
  }

  const patterns = input.allowedPaths.map((value) => value.trim()).filter(Boolean);
  if (patterns.length > 0 && !patterns.some((pattern) => pathMatches(parsed.pathname, pattern))) {
    return { host, message: "This host is outside your authorized scope.", ok: false, path: parsed.pathname };
  }

  return { host, message: "", ok: true, path: parsed.pathname };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function scopeLine(hosts: string[], paths: string[]): string {
  const hostText = hosts.length > 0 ? hosts.join(", ") : "no hosts are allowed yet";
  const pathText = paths.length > 0 ? paths.join(", ") : "all paths";
  return `Allowed hosts: ${hostText}. Allowed paths: ${pathText}.`;
}
