import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignInForm from "./SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/events");
  const { error } = await searchParams;

  return (
    <main className="quiet-page">
      <div className="folder-inside-label" aria-hidden="true">CO-HOST / EVENT PLANNING FILE</div>
      <section className="workspace">
        <div className="sheet-heading">
          <span>CO-HOST</span>
          <span>SIGN IN</span>
        </div>
        <h2 tabIndex={-1}>Sign in to your planner.</h2>
        <p className="intro">Your events are saved to your account, so you can come back to them any time.</p>
        {error === "expired" && (
          <p className="form-error" role="alert">
            That sign-in link has expired or was already used. Request a new one below.
          </p>
        )}
        <SignInForm />
        <footer>
          <span>Only you can see your events.</span>
        </footer>
      </section>
    </main>
  );
}
