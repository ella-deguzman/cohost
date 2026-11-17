"use client";

import { useActionState } from "react";
import { requestLoginLink, type SignInState } from "./actions";

export default function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(requestLoginLink, { message: "" });

  return (
    <form action={action}>
      <label htmlFor="email">Your email</label>
      <span className="help">We&rsquo;ll create a one-time sign-in link. No password needed.</span>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />

      {state.message && (
        <p className="form-note" role="status">
          {state.message}
        </p>
      )}
      {state.devLink && (
        <p className="dev-link">
          <strong>Development only:</strong> email isn&rsquo;t set up yet, so here is your link.{" "}
          <a href={state.devLink}>Sign in now</a>
        </p>
      )}

      <div className="actions">
        <span />
        <button className="primary" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email me a link"} <span>→</span>
        </button>
      </div>
    </form>
  );
}
