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
import { MAX_PHOTOS, OCCASIONS, VIBES, defaultPos, type Photo, type PiecePos } from "@/lib/collage";
import { EMPTY_EVENT, type EventInput } from "@/lib/validate";

type Initial = { id: string; version: number; input: EventInput; photos?: Photo[] };

/** Eight questions, then a "saved" page. */
const LAST = 8;
const DOT_LABELS = ["", "Name", "Occasion", "Vibe", "Size", "When", "Where", "Story", "Inspiration"];

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

/** Shrinks a photo to a small JPEG in the browser, so uploads stay quick and light. */
async function shrink(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.82));
  if (!blob) throw new Error("no jpeg");
  return { blob, w, h };
}

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

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
      cls: "pc-card",
      label: "Description",
      node: (
        <>
          <small>THE IDEA</small>
          <span className="pc-hand">{clip(f.description.trim(), 90)}</span>
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
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [dropping, setDropping] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const fileInput = useRef<HTMLInputElement>(null);

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

  // A photo dropped outside the folder would make the browser leave the page and lose the draft.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
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

  // ---- inspiration photos ----
  async function addFiles(input: FileList | File[]) {
    const images = Array.from(input).filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      setError("Those don't look like photos. Try JPG, PNG or WebP.");
      return;
    }
    const room = MAX_PHOTOS - photosRef.current.length;
    if (room <= 0) {
      setError(`The board holds up to ${MAX_PHOTOS} photos. Remove one to add another.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      // Photos belong to a saved draft, so make sure one exists first.
      if (!idRef.current) {
        const r = await runSave();
        if (!r.ok) {
          setError(r.error);
          return;
        }
      }
      let failed = "";
      for (const file of images.slice(0, room)) {
        try {
          const { blob, w, h } = await shrink(file);
          const body = new FormData();
          body.append("file", blob, "photo.jpg");
          body.append("w", String(w));
          body.append("h", String(h));
          const res = await fetch(`/events/${idRef.current}/photos`, { method: "POST", body });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            failed = data.error || "We couldn't add that photo.";
            continue;
          }
          setPhotos((p) => [...p, data as Photo]);
        } catch {
          failed = "We couldn't read one of those photos. Try a JPG or PNG.";
        }
      }
      if (failed) setError(failed);
      else if (images.length > room) setError(`Added what fits. The board holds up to ${MAX_PHOTOS} photos.`);
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(id: string) {
    try {
      const res = await fetch(`/photos/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("delete failed");
    } catch {
      setError("We couldn't remove that photo. Please try again.");
      return;
    }
    setPhotos((p) => p.filter((x) => x.id !== id));
    setF((p) => {
      const pos = { ...p.collage.pos };
      delete pos[`photo:${id}`];
      return { ...p, collage: { ...p.collage, pos } };
    });
    persistSoon();
  }

  function onDragOverFiles(e: React.DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDropping(true);
  }
  function onDragLeaveFiles(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
  }
  function onDropFiles(e: React.DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDropping(false);
    void addFiles(e.dataTransfer.files);
  }

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
    if (!next) {
      if ((e.key === "Delete" || e.key === "Backspace") && key.startsWith("photo:") && e.target === e.currentTarget) {
        e.preventDefault();
        void removePhoto(key.slice(6));
      }
      return;
    }
    e.preventDefault();
    setPiecePos(key, next);
    persistSoon();
  }

  const pieces: Piece[] = [
    ...buildPieces(f),
    ...photos.map((ph) => ({
      key: `photo:${ph.id}`,
      cls: "pc-print",
      label: "Inspiration photo",
      node: (
        <>
          <img
            src={`/photos/${ph.id}`}
            alt="Inspiration photo"
            draggable={false}
            style={{ "--ar": String(clamp(ph.w / ph.h, 0.6, 1.7)) } as CSSProperties}
          />
          <button
            type="button"
            className="pc-x"
            aria-label="Remove this photo"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void removePhoto(ph.id)}
          >
            ×
          </button>
        </>
      ),
    })),
  ];
  let vibeIndex = 0;
  let photoIndex = 0;

  const hasValue: Record<number, boolean> = {
    1: !!f.title.trim(),
    2: !!f.collage.occasion,
    3: f.collage.vibes.length > 0,
    4: !!(f.headcount.trim() || f.budget.trim()),
    5: !!(f.eventDate || f.eventTime),
    6: !!f.location.trim(),
    7: !!(f.description.trim() || f.notes.trim()),
    8: photos.length > 0,
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
      case 8:
        return (
          <>
            <h2 tabIndex={-1}>Any inspiration?</h2>
            <p className="intro">
              Drag photos anywhere onto this folder, or choose them below. They land on your board. Totally optional.
            </p>
            <div className={`dropzone${dropping ? " over" : ""}${uploading ? " busy" : ""}`}>
              <p>{uploading ? "Adding your photos…" : "Drop photos here"}</p>
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading || photos.length >= MAX_PHOTOS}>
                Choose photos
              </button>
              <small>
                {photos.length} of {MAX_PHOTOS} added
              </small>
              <input
                ref={fileInput}
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <main
      className={`quiet-page${dropping ? " drop-on" : ""}`}
      onDragOver={onDragOverFiles}
      onDragLeave={onDragLeaveFiles}
      onDrop={onDropFiles}
    >
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
          const idx = p.key.startsWith("vibe:") ? vibeIndex++ : p.key.startsWith("photo:") ? photoIndex++ : 0;
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
        <div className="board-drop" aria-hidden="true">
          Drop photos to add them
        </div>
      </div>
    </main>
  );
}
