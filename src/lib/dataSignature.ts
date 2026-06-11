/**
 * Cheap, stable signature used to detect whether persisted data changed between
 * renders. The 15s storage poll (`startStorageSyncPoll`) uses this to become a
 * no-op when nothing changed, so transient UI view state (popup active tab,
 * stats month drill-down, panel sub-step) survives instead of being rebuilt.
 *
 * If serialization fails (e.g. a circular value), return a unique string so the
 * caller treats it as "changed" and re-renders — never silently drops an update.
 */
export function signatureOf(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return `unserializable:${Date.now()}:${Math.random()}`;
  }
}
