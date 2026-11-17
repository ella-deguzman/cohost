import ClipLink from "@/components/ClipLink";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <section id="cover" aria-label="Your event planning folder">
      <div className="folder-stack">
        <div className="loose-sheet sheet-one" aria-hidden="true" />
        <div className="loose-sheet sheet-two" aria-hidden="true" />
        <div className="folder-tab" aria-hidden="true">01</div>
        <div className="cover-book">
          <ClipLink href={user ? "/events" : "/signin"} />
          <div className="folder-heading">
            <span className="folder-mark" aria-hidden="true">✳</span>
            <h1>CO-HOST</h1>
            <p>YOUR EVENT PLANNING FILE</p>
          </div>
          <div className="cover-folio">
            <span>GOOD COMPANY. THOUGHTFULLY PLANNED.</span>
            <span>FILE NO. 001</span>
          </div>
        </div>
      </div>
    </section>
  );
}
