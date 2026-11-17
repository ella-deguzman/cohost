import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEvents } from "@/lib/events";

function when(date: string | null, time: string | null) {
  if (!date) return "Date to be decided";
  const d = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return time ? `${d} · ${time}` : d;
}

export default async function MyEventsPage() {
  const user = await requireUser();
  const events = await listEvents(user.id);

  return (
    <main className="quiet-page">
      <div className="folder-inside-label" aria-hidden="true">CO-HOST / EVENT PLANNING FILE</div>
      <section className="workspace">
        <div className="sheet-heading">
          <span>CO-HOST</span>
          <span>MY EVENTS</span>
        </div>
        <h2 tabIndex={-1}>Your events.</h2>
        <p className="intro">Drafts and upcoming gatherings. Pick one up where you left off.</p>

        {events.length === 0 ? (
          <div className="gentle">
            <span>✧</span>
            <p>
              Nothing here yet.
              <br />
              <small>Start with an idea. You can save it as a draft and finish later.</small>
            </p>
          </div>
        ) : (
          <ul className="event-list">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="event-row">
                  <span className="event-title">{e.title}</span>
                  <span className="event-meta">
                    {when(e.event_date, e.event_time)}
                    {e.planning_headcount ? ` · ${e.planning_headcount} people` : ""}
                  </span>
                  <span className="status-pill">{e.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="actions">
          <span />
          <Link className="primary" href="/events/new">Create event <span>→</span></Link>
        </div>
        <footer>
          <span>Signed in as {user.email}</span>
        </footer>
      </section>
    </main>
  );
}
