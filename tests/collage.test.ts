import { describe, expect, it } from "vitest";
import { cleanCollage, defaultPos, MAX_PHOTOS } from "@/lib/collage";

const UUID = "3f2b8c1e-9a4d-4e7b-8c55-0a1b2c3d4e5f";

describe("cleanCollage: junk in, safe collage out", () => {
  it("turns anything that isn't an object into an empty collage", () => {
    for (const junk of [null, undefined, 5, "text", [], true]) {
      expect(cleanCollage(junk)).toEqual({ occasion: "", vibes: [], pos: {} });
    }
  });

  it("trims and caps the occasion at 40 characters", () => {
    expect(cleanCollage({ occasion: "  Birthday  " }).occasion).toBe("Birthday");
    expect(cleanCollage({ occasion: "x".repeat(80) }).occasion).toHaveLength(40);
    expect(cleanCollage({ occasion: 42 }).occasion).toBe("");
  });

  it("keeps vibes unique, text only, 30 characters each, 8 at most", () => {
    const vibes = cleanCollage({ vibes: ["Cozy", "Cozy", " Elegant ", 3, null, "y".repeat(50), "", "a", "b", "c", "d", "e", "f"] }).vibes;
    expect(vibes.slice(0, 2)).toEqual(["Cozy", "Elegant"]);
    expect(vibes[2]).toHaveLength(30);
    expect(vibes).toHaveLength(8);
    expect(new Set(vibes).size).toBe(vibes.length);
  });

  it("clamps positions and tilt into range", () => {
    const { pos } = cleanCollage({ pos: { title: { x: 5, y: -3, r: 99 } } });
    expect(pos.title).toEqual({ x: 1, y: 0, r: 15 });
  });

  it("falls back to safe numbers when a position isn't a number", () => {
    const { pos } = cleanCollage({ pos: { title: { x: "far", y: NaN, r: Infinity } } });
    expect(pos.title).toEqual({ x: 0.1, y: 0.1, r: 0 });
  });

  it("accepts keys for pieces, vibes and photos", () => {
    const p = { x: 0.5, y: 0.5, r: 0 };
    const { pos } = cleanCollage({ pos: { title: p, "vibe:Cozy": p, [`photo:${UUID}`]: p } });
    expect(Object.keys(pos).sort()).toEqual(["title", `photo:${UUID}`, "vibe:Cozy"].sort());
  });

  it("drops odd or dangerous keys", () => {
    const p = { x: 0.5, y: 0.5, r: 0 };
    // JSON.parse makes "__proto__" a real key, the way a hostile request would.
    const hostile = JSON.parse('{"__proto__":{"x":1},"<script>":{},"../etc":{},"a b":{},"vibe:<b>":{},"title":"nope"}');
    hostile["<script>"] = p;
    const { pos } = cleanCollage({ pos: hostile });
    expect(pos).toEqual({});
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("keeps at most 32 positions", () => {
    const many: Record<string, unknown> = {};
    for (let i = 0; i < 60; i++) many[`piece${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`] = { x: 0, y: 0, r: 0 };
    expect(Object.keys(cleanCollage({ pos: many }).pos).length).toBeLessThanOrEqual(32);
  });

  it("is stable: cleaning twice gives the same result", () => {
    const once = cleanCollage({ occasion: "Brunch", vibes: ["Cozy"], pos: { title: { x: 0.3, y: 0.4, r: -2 } } });
    expect(cleanCollage(once)).toEqual(once);
  });
});

describe("defaultPos: where pieces first land", () => {
  it("places known pieces in fixed spots", () => {
    expect(defaultPos("title")).toEqual({ x: 0.06, y: 0.18, r: -2 });
  });
  it("spreads vibe tags across rows", () => {
    expect(defaultPos("vibe:Cozy", 0).y).toBe(defaultPos("vibe:Elegant", 1).y);
    expect(defaultPos("vibe:Cozy", 3).y).toBeGreaterThan(defaultPos("vibe:Cozy", 0).y);
  });
  it("gives every photo a spot, and keeps the board's limit in step", () => {
    expect(MAX_PHOTOS).toBe(8);
    const spots = new Set(Array.from({ length: MAX_PHOTOS }, (_, i) => JSON.stringify(defaultPos(`photo:${UUID}`, i))));
    expect(spots.size).toBe(MAX_PHOTOS);
  });
  it("never lands outside the board", () => {
    for (let i = 0; i < 12; i++) {
      for (const key of [`photo:${UUID}`, "vibe:Cozy", "title", "unknown"]) {
        const p = defaultPos(key, i);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });
});
