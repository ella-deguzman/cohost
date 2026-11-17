"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { saveEvent, type SaveResult } from "@/app/events/actions";
import { OCCASIONS, VIBES, defaultPos, type PiecePos } from "@/lib/collage";
import { EMPTY_EVENT, type EventInput } from "@/lib/validate";

type Initial = { id: string; version: number; input: EventInput };

/** Seven questions, then a "saved" page. */
const LAST = 7;
const DOT_LABELS = ["", "Name", "Occasion", "Vibe", "Size", "When", "Where", "Story"];

const EXAMPLE: EventInput = {
  ...EMPTY_EVENT,
  title: "Cozy birthday dinner",
  description: "A cozy birthday dinner for friends, with small bites and simple decor.",
  headcount: "12",
  budget: "300",
  collage: { occasion: "Birthday", vibes: ["Cozy"], pos: {} },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function prettyTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

type Piece = { key: string; cls: string; label: string; node: ReactNode };

/** One paper piece for each thing the host has told us so far. */
function buildPieces(f: EventInput): Piece[] {
  const c = f.collage;
  const out: Piece[] = [];

  if (f.title.trim()) {
    out.push({
      key: "title",
      cls: "pc-label",
      label: "Event name",
      node: (
        <>
          <small>THE EVENT</small>
          <b>{clip(f.title.trim(), 42)}</b>
        </>
      ),
    });
  }
  if (c.occasion) {
    out.push({
      key: "occasion",
      cls: "pc-slip",
      label: "Occasion",
      node: (
        <>
          <small>OCCASION</small>
          <b>{c.occasion}</b>
        </>
      ),
    });
  }
  c.vibes.forEach((v) => out.push({ key: `vibe:${v}`, cls: "pc-tag", label: `Vibe: ${v}`, node: v }));

  if (f.headcount.trim()) {
    out.push({
      key: "guests",
      cls: "pc-ticket",
      label: "Guest count",
      node: (
        <>
          <span className="pc-num">{f.headcount.trim()}</span>
          <span className="pc-sub">
            ADMIT
            <br />
            GUESTS
          </span>
        </>
      ),
    });
  }
  if (f.budget.trim() && !Number.isNaN(Number(f.budget))) {
    out.push({
      key: "budget",
      cls: "pc-stamp",
      label: "Budget",
      node: (
        <>
          <b>{Number(f.budget).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</b>
          <small>BUDGET</small>
        </>
      ),
    });
  }
  if (f.eventDate || f.eventTime) {
    const d = f.eventDate ? new Date(`${f.eventDate}T12:00:00`) : null;
    out.push({
      key: "when",
      cls: "pc-calendar",
      label: "Date and time",
      node: (
        <>
          <span className="pc-month">{d ? d.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "DATE"}</span>
          <span className="pc-day">{d ? d.getDate() : "?"}</span>
          <span className="pc-when">
            {d ? d.toLocaleDateString("en-US", { weekday: "long" }) : "to be decided"}
            {f.eventTime ? (
              <>
                <br />
                {prettyTime(f.eventTime)}
              </>
            ) : null}
          </span>
        </>
      ),
    });
  }
  if (f.location.trim()) {
    out.push({
      key: "where",
      cls: "pc-pin",
      label: "Location",
      node: (
        <>
          <i className="pc-pinhead" />
          <small>WHERE</small>
          <span className="pc-hand">{clip(f.location.trim(), 60)}</span>
        </>
      ),
    });
  }
  if (f.description.trim()) {
    out.push({
      key: "story",
      cls: "pc-polaroid",
      label: "Description",
      node: (
        <>
          <span className="pc-photo">your photo here</span>
          <span className="pc-hand">{clip(f.description.trim(), 80)}</span>
        </>
      ),
    });
  }
  if (f.notes.trim()) {
    out.push({
      key: "notes",
      cls: "pc-sticky",
      label: "Notes",
      node: <span className="pc-hand">{clip(f.notes.trim(), 110)}</span>,
    });
  }
  return out;
}

export default function PlannerForm({ initial }: { initial?: Initial }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState<EventInput>(initial?.input ?? EMPTY_EVENT);
  const [eventId, setEventId] = useState<string | null>(initial?.id ?? null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [z, setZ] = useState<Record<string, number>>({});

  // Latest values for code that runs later (timers, the save queue).
  const fRef = useRef(f);
  fRef.current = f;
  const idRef = useRef<string | null>(initial?.id ?? null);
  const versionRef = useRef<number | null>(initial?.version ?? null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const zTop = useRef(10);
  const firstRender = useRef(true);
  const drag = useRef<{
    key: string;
    sx: number;
    sy: number;
    px: number;
    py: number;
    r: number;
    w: number;
    h: number;
    bw: number;
    bh: number;
  } | null>(null);

  // Remember the browser's time zone so the event keeps it.
  useEffect(() => {
    setF((p) => (p.timeZone ? p : { ...p, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  }, []);

  // Move keyboard focus to each new question (but not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.querySelector<HTMLElement>(".guided h2")?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => () => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
  }, []);

  /**
   * Saves one at a time, so two saves can never race each other for the version number.
   * Every save sends the newest values, whenever it actually runs.
   */
  function runSave(): Promise<SaveResult> {
    const job = queue.current.then(async () => {
      const r = await saveEvent(fRef.current, idRef.current, versionRef.current);
      if (r.ok) {
        idRef.current = r.id;
        versionRef.current = r.version;
        setEventId(r.id);
      }
      return r;
    });
    queue.current = job.catch(() => undefined);
    return job;
  }

  function advance(next: number) {
    setError("");
    startTransition(async () => {
      const r = await runSave();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setStep(next);
    });
  }

  /** After a piece is moved, save quietly (only once the draft exists). */
  function persistSoon() {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      if (idRef.current) void runSave();
    }, 700);
  }

  const set =
    (key: Exclude<keyof EventInput, "collage">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((p) => ({ ...p, [key]: e.target.value }));

  const setOccasion = (value: string) => setF((p) => ({ ...p, collage: { ...p.collage, occasion: value } }));
  const toggleVibe = (v: string) =>
    setF((p) => {
      const has = p.collage.vibes.includes(v);
      const vibes = has ? p.collage.vibes.filter((x) => x !== v) : [...p.collage.vibes, v].slice(0, 6);
      return { ...p, collage: { ...p.collage, vibes } };
    });
  const setPiecePos = (key: string, pos: PiecePos) =>
    setF((p) => ({ ...p, collage: { ...p.collage, pos: { ...p.collage.pos, [key]: pos } } }));

  // ---- dragging pieces around the board ----
  function onDown(e: ReactPointerEvent<HTMLDivElement>, key: string, cur: PiecePos) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const board = boardRef.current;
    if (!board) return;
    const b = board.getBoundingClientRect();
    const el = e.currentTarget;
    drag.current = {
      key,
      sx: e.clientX,
      sy: e.clientY,
      px: cur.x,
      py: cur.y,
      r: cur.r,
      w: el.offsetWidth,
      h: el.offsetHeight,
      bw: b.width,
      bh: b.height,
    };
    el.setPointerCapture(e.pointerId);
    setDragging(key);
    setZ((prev) => ({ ...prev, [key]: ++zTop.current }));
  }
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setPiecePos(d.key, {
      x: clamp(d.px + (e.clientX - d.sx) / d.bw, 0, Math.max(0, 1 - d.w / d.bw)),
      y: clamp(d.py + (e.clientY - d.sy) / d.bh, 0, Math.max(0, 1 - d.h / d.bh)),
      r: d.r,
    });
  }
  function onUp() {
    if (!drag.current) return;
    drag.current = null;
    setDragging(null);
    persistSoon();
  }
  /** Arrow keys nudge the focused piece; "," and "." tilt it. For anyone not using a mouse. */
  function onKey(e: ReactKeyboardEvent<HTMLDivElement>, key: string, cur: PiecePos) {
    const board = boardRef.current;
    if (!board) return;
    const b = board.getBoundingClientRect();
    const el = e.currentTarget;
    const maxX = Math.max(0, 1 - el.offsetWidth / b.width);
    const maxY = Math.max(0, 1 - el.offsetHeight / b.height);
    const nudge = 0.025;
    let next: PiecePos | null = null;
    if (e.key === "ArrowLeft") next = { ...cur, x: clamp(cur.x - nudge, 0, maxX) };
    else if (e.key === "ArrowRight") next = { ...cur, x: clamp(cur.x + nudge, 0, maxX) };
    else if (e.key === "ArrowUp") next = { ...cur, y: clamp(cur.y - nudge, 0, maxY) };
    else if (e.key === "ArrowDown") next = { ...cur, y: clamp(cur.y + nudge, 0, maxY) };
    else if (e.key === ",") next = { ...cur, r: clamp(cur.r - 2, -15, 15) };
    else if (e.key === ".") next = { ...cur, r: clamp(cur.r + 2, -15, 15) };
    if (!next) return;
    e.preventDefault();
    setPiecePos(key, next);
    persistSoon();
  }

  const pieces = buildPieces(f);
  let vibeIndex = 0;

  const hasValue: Record<number, boolean> = {
    1: !!f.title.trim(),
    2: !!f.collage.occasion,
    3: f.collage.vibes.length > 0,
    4: !!(f.headcount.trim() || f.budget.trim()),
    5: !!(f.eventDate || f.eventTime),
    6: !!f.location.trim(),
    7: !!(f.description.trim() || f.notes.trim()),
  };

  const money = f.budget ? Number(f.budget).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "";
  const facts = [
    f.collage.occasion && `${f.collage.occasion}${f.collage.vibes.length ? `, ${f.collage.vibes.join(", ").toLowerCase()}` : ""}`,
    [f.headcount && `${f.headcount} people, including you`, money && `${money} total budget`].filter(Boolean).join(" · ") ||
      "Headcount and budget to be decided",
    f.eventDate
      ? new Date(`${f.eventDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) +
        (f.eventTime ? ` · ${prettyTime(f.eventTime)}` : "")
      : "Date to be decided",
    f.location.trim() || "Location to be decided",
  ]
    .filter(Boolean)
    .join("\n");

  const errorBox = error && (
    <p className="form-error" role="alert">
      {error}
    </p>
  );

  function jump(n: number) {
    if (n === step || (n > 1 && !f.title.trim())) return;
    setError("");
    setStep(n);
  }

  /** The question on the white page for the current step. */
  function question(): ReactNode {
    switch (step) {
      case 1:
        return (
          <>
            <h2 tabIndex={-1}>What should we call it?</h2>
            <p className="intro">Give your event a name. You can change it any time.</p>
            <label htmlFor="title">Event name</label>
            <input
              id="title"
              value={f.title}
              onChange={set("title")}
              required
              maxLength={120}
              placeholder="Cozy birthday dinner"
              autoComplete="off"
            />
            <div className="example">
              <span>Need a starting point?</span>{" "}
              <button type="button" onClick={() => setF((p) => ({ ...EXAMPLE, timeZone: p.timeZone, collage: { ...EXAMPLE.collage, pos: p.collage.pos } }))}>
                Try our cozy dinner ↗
              </button>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <h2 tabIndex={-1}>What are we celebrating?</h2>
            <p className="intro">Tap one. It lands on your idea board.</p>
            <div className="choice-grid" role="group" aria-label="Occasion">
              {OCCASIONS.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`choice${f.collage.occasion === o ? " on" : ""}`}
                  aria-pressed={f.collage.occasion === o}
                  onClick={() => setOccasion(f.collage.occasion === o ? "" : o)}
                >
                  {o}
                </button>
              ))}
            </div>
            <label htmlFor="other-occasion">Something else?</label>
            <input
              id="other-occasion"
              value={OCCASIONS.includes(f.collage.occasion) ? "" : f.collage.occasion}
              onChange={(e) => setOccasion(e.target.value)}
              maxLength={40}
              placeholder="Book club, engagement party…"
              autoComplete="off"
            />
          </>
        );
      case 3:
        return (
          <>
            <h2 tabIndex={-1}>What&rsquo;s the vibe?</h2>
            <p className="intro">Pick as many as you like (up to six).</p>
            <div className="choice-grid" role="group" aria-label="Vibe">
              {VIBES.map((v) => {
                const on = f.collage.vibes.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    className={`choice${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggleVibe(v)}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </>
        );
      case 4: {
        const guests = Number(f.headcount) || 0;
        const budget = Number(f.budget) || 0;
        return (
          <>
            <h2 tabIndex={-1}>How big is it?</h2>
            <p className="intro">Rough numbers are perfect. You can change them later.</p>

            <label htmlFor="people">How many people? <span className="optional">Including you</span></label>
            <div className="stepper">
              <button
                type="button"
                aria-label="One fewer person"
                onClick={() => setF((p) => ({ ...p, headcount: String(Math.max(1, (Number(p.headcount) || 2) - 1)) }))}
              >
                −
              </button>
              <input id="people" type="number" min={1} max={10000} step={1} value={f.headcount} onChange={set("headcount")} placeholder="12" />
              <button
                type="button"
                aria-label="One more person"
                onClick={() => setF((p) => ({ ...p, headcount: String(Math.min(10000, (Number(p.headcount) || 0) + 1)) }))}
              >
                +
              </button>
            </div>

            <label htmlFor="budget">Total event budget <span className="optional">USD</span></label>
            <div className="money">
              <span>$</span>
              <input id="budget" type="number" min={0} step={0.01} value={f.budget} onChange={set("budget")} placeholder="300" />
              <span>USD</span>
            </div>
            <input
              className="range"
              type="range"
              min={0}
              max={2000}
              step={25}
              value={clamp(budget, 0, 2000)}
              aria-label="Budget slider"
              onChange={(e) => setF((p) => ({ ...p, budget: e.target.value }))}
            />
            <div className="range-ends" aria-hidden="true">
              <span>$0</span>
              <span>$2,000</span>
            </div>
            {guests > 0 && budget > 0 && (
              <p className="per-head">About {(budget / guests).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} a person.</p>
            )}
          </>
        );
      }
      case 5:
        return (
          <>
            <h2 tabIndex={-1}>When is it?</h2>
            <p className="intro">
              Still figuring it out? That&rsquo;s okay. Skip it and come back later.
            </p>
            <div className="grid">
              <div>
                <label htmlFor="date">Date</label>
                <input id="date" type="date" value={f.eventDate} onChange={set("eventDate")} />
              </div>
              <div>
                <label htmlFor="time">Time</label>
                <input id="time" type="time" value={f.eventTime} onChange={set("eventTime")} />
              </div>
            </div>
          </>
        );
      case 6:
        return (
          <>
            <h2 tabIndex={-1}>Where will it be?</h2>
            <p className="intro">Your home, a park, a venue, or just a city. Even a general idea helps.</p>
            <label htmlFor="location">Location</label>
            <input
              id="location"
              value={f.location}
              onChange={set("location")}
              maxLength={300}
              placeholder="My place, or Prospect Park"
              autoComplete="off"
            />
          </>
        );
      case 7:
        return (
          <>
            <h2 tabIndex={-1}>Tell us the story.</h2>
            <p className="intro">What do you picture? Add any requests too. Both are optional.</p>
            <label htmlFor="vibe">Describe it</label>
            <textarea
              id="vibe"
              value={f.description}
              onChange={set("description")}
              maxLength={1200}
              placeholder="A cozy birthday dinner for friends, with small bites and simple decor."
            />
            <label htmlFor="notes">Anything else we should know?</label>
            <textarea
              id="notes"
              rows={2}
              value={f.notes}
              onChange={set("notes")}
              maxLength={2000}
              placeholder="Dietary needs, things to avoid, or special requests…"
            />
          </>
        );
      default:
        return null;
    }
  }

  return (
    <main className="quiet-page">
      <div className="folder-inside-label" aria-hidden="true">CO-HOST / EVENT PLANNING FILE</div>

      <section className="workspace guided">
        <div className="sheet-heading">
          <span>CO-HOST</span>
          <span>{step > LAST ? "SAVED" : `QUESTION 0${step} / 0${LAST}`}</span>
        </div>

        {step <= LAST && (
          <nav className="dots" aria-label="Questions">
            {Array.from({ length: LAST }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`dot${n === step ? " active" : ""}${n < step ? " done" : ""}`}
                aria-label={`Question ${n}: ${DOT_LABELS[n]}`}
                aria-current={n === step ? "step" : undefined}
                disabled={n > 1 && !f.title.trim()}
                onClick={() => jump(n)}
              />
            ))}
          </nav>
        )}

        {step <= LAST ? (
          <form
            key={step}
            className="q"
            onSubmit={(e) => {
              e.preventDefault();
              advance(step + 1);
            }}
          >
            {question()}
            {errorBox}
            <div className="actions">
              {step > 1 ? (
                <button type="button" className="back" onClick={() => setStep(step - 1)}>
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <button className="primary" type="submit" disabled={pending}>
                {pending ? "Saving…" : step === LAST ? "Finish" : step === 1 || hasValue[step] ? "Next" : "Skip"} <span>{step === LAST ? "✧" : "→"}</span>
              </button>
            </div>
          </form>
        ) : (
          <section className="q" id="result">
            <h2 tabIndex={-1}>Your idea board is saved.</h2>
            <p className="intro">Rearrange the pieces any time, or pick it up again from My events.</p>

            <div className="summary">
              <span>YOUR EVENT BRIEF</span>
              <p>{f.title}</p>
              <div id="facts">{facts}</div>
            </div>

            <p className="demo-notice">
              Menu, shopping list and tasks come in the next build step. Nothing here is generated yet, and nothing is
              shared with anyone.
            </p>

            <div className="actions">
              <button type="button" className="back" onClick={() => setStep(1)}>
                ← Edit answers
              </button>
              <Link className="primary" href="/events">
                Back to my events <span>→</span>
              </Link>
            </div>
          </section>
        )}

        <footer>
          <span>{eventId ? "Saved to your account. Only you can see it." : "Not saved yet."}</span>
          <span>{step > LAST ? "✓" : `0${step}`}</span>
        </footer>
      </section>

      <div className="board" ref={boardRef} role="group" aria-label="Your idea board. Drag the pieces to arrange them.">
        {pieces.map((p) => {
          const idx = p.key.startsWith("vibe:") ? vibeIndex++ : 0;
          const pos = f.collage.pos[p.key] ?? defaultPos(p.key, idx);
          return (
            <div
              key={p.key}
              role="group"
              tabIndex={0}
              aria-label={`${p.label}. Drag to move, or use the arrow keys.`}
              className={`pc ${p.cls}${dragging === p.key ? " dragging" : ""}`}
              style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, zIndex: z[p.key] ?? 1, "--r": `${pos.r}deg` } as CSSProperties}
              onPointerDown={(e) => onDown(e, p.key, pos)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={(e) => onKey(e, p.key, pos)}
            >
              {p.node}
            </div>
          );
        })}
      </div>
    </main>
  );
}
