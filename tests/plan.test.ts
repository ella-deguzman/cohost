import { describe, expect, it } from "vitest";
import { cleanPlanChoices, EMPTY_PLAN, hasPlanChoices } from "@/lib/plan";

describe("cleanPlanChoices", () => {
  it("turns junk into 'nothing asked for'", () => {
    for (const junk of [null, undefined, 3, "yes", [], {}]) {
      expect(cleanPlanChoices(junk)).toEqual(EMPTY_PLAN);
    }
  });

  it("only treats a real true as a yes", () => {
    const r = cleanPlanChoices({ menu: "true", shopping: 1, tasks: "yes" });
    expect(r).toEqual({ menu: false, menuKinds: [], shopping: false, tasks: false });
  });

  it("keeps the kinds of menu the host picked, once each", () => {
    const r = cleanPlanChoices({ menu: true, menuKinds: ["Snacks", "Drinks", "Snacks"] });
    expect(r.menuKinds).toEqual(["Snacks", "Drinks"]);
  });

  it("drops kinds we don't offer", () => {
    const r = cleanPlanChoices({ menu: true, menuKinds: ["Snacks", "Sushi", 7, null] });
    expect(r.menuKinds).toEqual(["Snacks"]);
  });

  it("never leaves a menu with no kind: it becomes a full meal", () => {
    expect(cleanPlanChoices({ menu: true, menuKinds: [] }).menuKinds).toEqual(["Full meal"]);
    expect(cleanPlanChoices({ menu: true, menuKinds: ["Sushi"] }).menuKinds).toEqual(["Full meal"]);
  });

  it("forgets the kinds when the menu is off", () => {
    expect(cleanPlanChoices({ menu: false, menuKinds: ["Snacks"] }).menuKinds).toEqual([]);
  });

  it("is stable: cleaning twice gives the same result", () => {
    const once = cleanPlanChoices({ menu: true, menuKinds: ["Drinks"], shopping: true, tasks: true });
    expect(cleanPlanChoices(once)).toEqual(once);
  });
});

describe("hasPlanChoices", () => {
  it("is true when anything is checked", () => {
    expect(hasPlanChoices(EMPTY_PLAN)).toBe(false);
    expect(hasPlanChoices({ ...EMPTY_PLAN, tasks: true })).toBe(true);
    expect(hasPlanChoices({ ...EMPTY_PLAN, shopping: true })).toBe(true);
    expect(hasPlanChoices(cleanPlanChoices({ menu: true }))).toBe(true);
  });
});
