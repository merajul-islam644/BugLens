// The runtime Data Gateway wraps every query result in the generated operation
// name (`getProjects`, `getEnvironments`, ...), so list reads are unwrapped in
// one place rather than per feature.
export type NodeList<T> = { items: T[]; totalCount: number };

/**
 * A gateway call can answer 200 OK and still carry an `errors` array, so every
 * read and write is checked here rather than trusting the HTTP status alone.
 */
export function assertGraphqlOk(response: unknown, failureMessage: string): void {
  const errors = (response as { errors?: unknown } | undefined)?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as { message?: unknown } | undefined;
    const detail = typeof first?.message === "string" ? first.message : "";
    throw new Error(detail ? `${failureMessage} ${detail}` : failureMessage);
  }
}

export function unwrapItems<T>(response: unknown, queryName: string): NodeList<T> {
  assertGraphqlOk(response, `The ${queryName.toLowerCase()} list could not be read.`);
  const envelope = (response ?? {}) as Record<string, unknown>;
  const data = (envelope.data ?? envelope) as Record<string, unknown>;
  const operation = data[`get${queryName}`] as Record<string, unknown> | undefined;
  const source = operation ?? data;
  const items = (source.items ?? []) as T[];
  const totalCount = typeof source.totalCount === "number" ? source.totalCount : items.length;
  return { items: Array.isArray(items) ? items : [], totalCount };
}

/** Turns a caught failure into the sentence a member is shown. */
export function failureMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function recordId(record: object | undefined): string {
  if (!record) return "";
  const values = record as Record<string, unknown>;
  const id = values.itemId ?? values.ItemId ?? values.id;
  return id ? String(id) : "";
}

/**
 * The gateway names the key `ItemId`; the app works with `itemId` everywhere, so
 * every record read carries it as one guaranteed string.
 */
export function withId<T extends object>(record: T): T & { itemId: string } {
  return { ...record, itemId: recordId(record) };
}

export function withIds<T extends object>(records: T[]): Array<T & { itemId: string }> {
  return (records ?? []).map((record) => withId(record));
}
