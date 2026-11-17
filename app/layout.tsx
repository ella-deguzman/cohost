import type { Metadata } from "next";
import Link from "next/link";
import { endSession, getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import "./globals.css";


export const metadata: Metadata = {
  title: "Co-host — Your planning file",
  description: "Turn an event idea into a plan you can actually follow.",
};

async function signOut() {
  "use server";
  await endSession();
  redirect("/");
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      {/* Browser extensions (like Grammarly) add attributes to <body> before React loads.
          suppressHydrationWarning stops that from showing as a false error. */}
      <body suppressHydrationWarning>
        <header>
          <Link className="brand" href="/" aria-label="AI Co-Host home">
            co-host<span className="ai">THE PLANNING FILE</span>
          </Link>
          {user && (
            <div className="header-nav">
              <Link className="contents-button" href="/events">My events</Link>
              <form action={signOut}>
                <button className="contents-button" type="submit">Sign out</button>
              </form>
            </div>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
