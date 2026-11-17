// Email delivery is not set up yet (the design doc lists it as an open decision).
// For now the sign-in link is printed in the terminal where `npm run dev` is running,
// and the sign-in page also shows it on screen (development only).
// Later, replace the body of this function with a real email provider.
export async function sendLoginEmail(to: string, link: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Email delivery is not configured yet.");
  }
  console.log(`\n[co-host] Sign-in link for ${to}:\n${link}\n`);
}
