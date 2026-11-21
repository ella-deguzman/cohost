import { describe, expect, it } from "vitest";
import { EMPTY_EVENT, validate, type EventInput } from "@/lib/validate";

const ok = (over: Partial<EventInput> = {}) => validate({ ...EMPTY_EVENT, title: "Cozy dinner", ...over });
const errorOf = (over: Partial<EventInput>) => {
  const r = ok(over);
  if (!("error" in r)) throw new Error("expected an error");
  return r.error;
};
const valueOf = (over: Partial<EventInput> = {}) => {
  const r = ok(over);
  if (!("value" in r)) throw new Error(`expected a value, got: ${r.error}`);
  return r.value;
};

describe("validate: name", () => {
  it("needs a name", () => {
    expect(errorOf({ title: "" })).toMatch(/name/i);
    expect(errorOf({ title: "   " })).toMatch(/name/i);
  });
  it("trims the name", () => {
    expect(valueOf({ title: "  Brunch  " }).title).toBe("Brunch");
  });
  it("allows 120 characters but not 121", () => {
    expect(valueOf({ title: "a".repeat(120) }).title).toHaveLength(120);
    expect(errorOf({ title: "a".repeat(121) })).toMatch(/120/);
  });
});

describe("validate: text limits", () => {
  it("limits the description, notes and location", () => {
    expect(errorOf({ description: "a".repeat(1201) })).toMatch(/1,200/);
    expect(errorOf({ notes: "a".repeat(2001) })).toMatch(/2,000/);
    expect(errorOf({ location: "a".repeat(301) })).toMatch(/300/);
  });
});

describe("validate: headcount", () => {
  it("accepts whole numbers and blank", () => {
    expect(valueOf({ headcount: "12" }).headcount).toBe(12);
    expect(valueOf({ headcount: "" }).headcount).toBeNull();
  });
  it("rejects decimals, words, zero and huge numbers", () => {
    for (const bad of ["1.5", "twelve", "-3", "0", "10001", "123456"]) {
      expect(errorOf({ headcount: bad })).toBeTruthy();
    }
  });
});

describe("validate: budget (money stays exact text)", () => {
  it("accepts dollars with up to 2 decimals", () => {
    expect(valueOf({ budget: "300" }).budget).toBe("300");
    expect(valueOf({ budget: "300.50" }).budget).toBe("300.50");
    expect(valueOf({ budget: "0" }).budget).toBe("0");
    expect(valueOf({ budget: "" }).budget).toBeNull();
  });
  it("rejects negatives, 3 decimals, symbols and words", () => {
    for (const bad of ["-5", "300.567", "$300", "abc", "1e5", "300,50"]) {
      expect(errorOf({ budget: bad })).toMatch(/budget/i);
    }
  });
});

describe("validate: date and time", () => {
  it("accepts a real date and time, or blanks", () => {
    const v = valueOf({ eventDate: "2026-12-24", eventTime: "19:30" });
    expect(v.eventDate).toBe("2026-12-24");
    expect(v.eventTime).toBe("19:30");
    expect(valueOf().eventDate).toBeNull();
    expect(valueOf().eventTime).toBeNull();
  });
  it("accepts a leap day only in a leap year", () => {
    expect(valueOf({ eventDate: "2028-02-29" }).eventDate).toBe("2028-02-29");
    expect(errorOf({ eventDate: "2027-02-29" })).toMatch(/date/i);
  });
  it("rejects dates that don't exist", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "12/24/2026", "tomorrow"]) {
      expect(errorOf({ eventDate: bad })).toMatch(/date/i);
    }
  });
  it("rejects times that don't exist", () => {
    for (const bad of ["24:00", "25:00", "7:30", "19:60", "noon"]) {
      expect(errorOf({ eventTime: bad })).toMatch(/time/i);
    }
  });
});

describe("validate: time zone and idea board", () => {
  it("keeps the time zone but caps its length", () => {
    expect(valueOf({ timeZone: "America/New_York" }).timeZone).toBe("America/New_York");
    expect(valueOf({ timeZone: "x".repeat(200) }).timeZone).toHaveLength(64);
    expect(valueOf({ timeZone: "" }).timeZone).toBeNull();
  });
  it("cleans the plan choices on every save", () => {
    const v = valueOf({ planChoices: { menu: true, menuKinds: ["Snacks", "Sushi"], shopping: true, tasks: "yes" } as never });
    expect(v.planChoices).toEqual({ menu: true, menuKinds: ["Snacks"], shopping: true, tasks: false });
  });
  it("cleans the idea board on every save", () => {
    const messy = { occasion: "x".repeat(100), vibes: ["Cozy", "Cozy", 7], pos: { "<script>": { x: 1, y: 1, r: 1 } } };
    const v = valueOf({ collage: messy as never });
    expect(v.collage.occasion).toHaveLength(40);
    expect(v.collage.vibes).toEqual(["Cozy"]);
    expect(v.collage.pos).toEqual({});
  });
});
