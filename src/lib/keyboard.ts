type KeyEventLike = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "target"
>;

/** True when focus is inside a text-entry control where shortcuts must not hijack typing. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
  };
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** True when a keydown event should toggle the Ninepop help modal (pressing "?"). */
export function isHelpToggleEvent(e: KeyEventLike): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isEditableTarget(e.target)) return false;
  return e.key === "?";
}
