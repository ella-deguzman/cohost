import Link from "next/link";

export default function NotFound() {
  return (
    <main className="quiet-page">
      <div className="folder-inside-label" aria-hidden="true">CO-HOST / EVENT PLANNING FILE</div>
      <section className="workspace">
        <div className="sheet-heading">
          <span>CO-HOST</span>
          <span>NOT FOUND</span>
        </div>
        <h2>We couldn&rsquo;t find that page.</h2>
        <p className="intro">It may not exist, or it may belong to someone else&rsquo;s planner.</p>
        <div className="actions">
          <span />
          <Link className="primary" href="/events">Back to my events <span>→</span></Link>
        </div>
      </section>
    </main>
  );
}
