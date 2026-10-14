// EV-03 — text a member types cannot hold a credential. The rules are fixed;
// a saved value that matches one is refused with the line it appeared on.
const CREDENTIAL_RULES: { label: string; pattern: RegExp }[] = [
  { label: "Authorization:", pattern: /authorization\s*:/i },
  { label: "Cookie:", pattern: /(^|\s)cookie\s*:/i },
  { label: "Set-Cookie:", pattern: /set-cookie\s*:/i },
  { label: "a 40-character token", pattern: /\b[A-Za-z0-9_\-+/=]{40}\b/ },
  { label: "password=", pattern: /password\s*=/i },
  { label: "api_key=", pattern: /api[_-]?key\s*=/i }
];

export const MASKING_RULE_LABELS = CREDENTIAL_RULES.map((rule) => rule.label);

export type CredentialHit = { line: number; rule: string };

/** The first credential match in typed text, counted from line 1. */
export function findCredential(text: string | undefined): CredentialHit | undefined {
  if (!text) return undefined;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    for (const rule of CREDENTIAL_RULES) {
      if (rule.pattern.test(line)) return { line: index + 1, rule: rule.label };
    }
  }
  return undefined;
}

export function credentialRefusal(hit: CredentialHit): string {
  return `Remove the credential on line ${hit.line}, or mark this item as containing sensitive values.`;
}

/** Throws the member-facing refusal when typed text holds a credential. */
export function assertNoCredential(text: string | undefined): void {
  const hit = findCredential(text);
  if (hit) throw new Error(credentialRefusal(hit));
}
