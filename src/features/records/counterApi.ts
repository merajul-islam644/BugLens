import { blocksClient } from "../../lib/blocks/client";
import { assertGraphqlOk, unwrapItems, withIds } from "../../lib/blocks/records";

type CounterRecord = { itemId?: string; name?: string; value?: number; workspaceId?: string };

const counters = blocksClient.data.collection<CounterRecord>("Counter", {
  fields: ["name", "value", "workspaceId"]
});

const START_VALUES: Record<string, number> = { BUG: 1000, INV: 1000, EVD: 2200 };

/** The next display number for a prefix: BUG-1001 upward, unique across the workspace. */
export async function nextId(workspaceId: string, prefix: string): Promise<string> {
  const response = await counters.list({ pageNo: 1, pageSize: 100 });
  const all = withIds(unwrapItems<CounterRecord>(response, "Counters").items);
  const existing = all.find((counter) => counter.name === prefix && counter.workspaceId === workspaceId);

  if (!existing) {
    const first = (START_VALUES[prefix] ?? 1000) + 1;
    assertGraphqlOk(await counters.create({ name: prefix, value: first, workspaceId }), "The record number could not be assigned.");
    return `${prefix}-${first}`;
  }

  const next = (existing.value ?? START_VALUES[prefix] ?? 1000) + 1;
  assertGraphqlOk(await counters.update(existing.itemId, { value: next }), "The record number could not be assigned.");
  return `${prefix}-${next}`;
}
