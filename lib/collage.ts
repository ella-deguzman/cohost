// The collage on the left page of the open folder: which paper pieces are on it
// and where the host dragged each one. Shared by the browser and the server.

/** x and y are fractions (0 to 1) of the board, r is the tilt in degrees. */
export type PiecePos = { x: number; y: number; r: number };

export type Collage = {
  occasion: string;
  vibes: string[];
  pos: Record<string, PiecePos>;
};

export const EMPTY_COLLAGE: Collage = { occasion: "", vibes: [], pos: {} };

export const OCCASIONS = ["Birthday", "Dinner party", "Brunch", "Housewarming", "Holiday", "Just because"];
export const VIBES = ["Cozy", "Elegant", "Playful", "Rustic", "Modern", "Garden", "Festive", "Low-key"];

/** Where a piece first lands. The host can drag it anywhere after that. */
const START: Record<string, PiecePos> = {
  title: { x: 0.06, y: 0.18, r: -2 },
  occasion: { x: 0.56, y: 0.16, r: 4 },
  guests: { x: 0.05, y: 0.44, r: -3 },
  budget: { x: 0.42, y: 0.42, r: 6 },
  when: { x: 0.66, y: 0.38, r: 3 },
  where: { x: 0.06, y: 0.6, r: 2 },
  story: { x: 0.5, y: 0.58, r: -4 },
  notes: { x: 0.12, y: 0.78, r: -2 },
};
const VIBE_TILTS = [-3, 2, -1, 3, -2, 1, 2, -3];

export function defaultPos(key: string, vibeIndex = 0): PiecePos {
  if (key.startsWith("vibe:")) {
    return {
      x: 0.06 + (vibeIndex % 3) * 0.21,
      y: 0.33 + Math.floor(vibeIndex / 3) * 0.055,
      r: VIBE_TILTS[vibeIndex % VIBE_TILTS.length],
    };
  }
  return START[key] ?? { x: 0.2, y: 0.2, r: 0 };
}

function num(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

const KEY = /^[a-z]{1,12}(:[A-Za-z0-9 '-]{1,30})?$/;

/**
 * Turns anything the browser sends into a safe collage. The server runs this on every
 * save, so a made-up request can't store oversized or odd data.
 */
export function cleanCollage(raw: unknown): Collage {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const occasion = typeof o.occasion === "string" ? o.occasion.trim().slice(0, 40) : "";

  const vibes: string[] = [];
  if (Array.isArray(o.vibes)) {
    for (const v of o.vibes) {
      if (typeof v !== "string") continue;
      const t = v.trim().slice(0, 30);
      if (t && !vibes.includes(t) && vibes.length < 8) vibes.push(t);
    }
  }

  const pos: Record<string, PiecePos> = {};
  if (o.pos && typeof o.pos === "object") {
    for (const [k, v] of Object.entries(o.pos as Record<string, unknown>).slice(0, 24)) {
      if (!KEY.test(k) || !v || typeof v !== "object") continue;
      const p = v as Record<string, unknown>;
      pos[k] = { x: num(p.x, 0, 1, 0.1), y: num(p.y, 0, 1, 0.1), r: num(p.r, -15, 15, 0) };
    }
  }

  return { occasion, vibes, pos };
}
