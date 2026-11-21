import { describe, expect, it } from "vitest";
import { isEditableTarget, isHelpToggleEvent } from "./keyboard";

describe("keyboard helpers", () => {
  it("detects editable targets cleanly", () => {
    expect(isEditableTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "textarea" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget({ tagName: "BODY" } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it("matches '?' outside editable inputs and without modifier chords", () => {
    const base = {
      key: "?",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target: { tagName: "BODY" } as unknown as EventTarget,
    };
    expect(isHelpToggleEvent(base)).toBe(true);
    expect(isHelpToggleEvent({ ...base, key: "/" })).toBe(false);
    expect(isHelpToggleEvent({ ...base, ctrlKey: true })).toBe(false);
    expect(isHelpToggleEvent({ ...base, metaKey: true })).toBe(false);
    expect(isHelpToggleEvent({ ...base, altKey: true })).toBe(false);
    expect(
      isHelpToggleEvent({
        ...base,
        target: { tagName: "INPUT" } as unknown as EventTarget,
      }),
    ).toBe(false);
  });
});
