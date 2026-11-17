"use server";

import { getCurrentUser } from "@/lib/auth";
import { createEvent, updateEvent } from "@/lib/events";
import { validate, type EventInput } from "@/lib/validate";

export type SaveResult =
  | { ok: true; id: string; version: number }
  | { ok: false; error: string };

/** Saves a draft. With no id it creates a new event; otherwise it updates that one. */
export async function saveEvent(
  input: EventInput,
  id: string | null,
  version: number | null,
): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your sign-in expired. Please sign in again." };

  const checked = validate(input);
  if ("error" in checked) return { ok: false, error: checked.error };

  try {
    if (!id) {
      const created = await createEvent(user.id, checked.value);
      return { ok: true, id: created.id, version: created.version };
    }
    const newVersion = await updateEvent(id, user.id, version ?? -1, checked.value);
    if (newVersion === null) {
      return {
        ok: false,
        error: "This draft changed somewhere else, or isn't yours to edit. Reload the page to see the latest version.",
      };
    }
    return { ok: true, id, version: newVersion };
  } catch (err) {
    console.error("saveEvent failed", err);
    return { ok: false, error: "We couldn't save that. Please try again." };
  }
}
