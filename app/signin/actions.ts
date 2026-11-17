"use server";

import { createLoginToken } from "@/lib/auth";
import { sendLoginEmail } from "@/lib/email";

export type SignInState = { message: string; devLink?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestLoginLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return { message: "Enter a valid email address." };
  }

  try {
    const token = await createLoginToken(email);
    if (!token) return { message: "Too many sign-in requests. Please wait a while and try again." };

    const base = process.env.APP_URL ?? "http://localhost:3000";
    const link = `${base}/auth/verify?token=${token}`;
    await sendLoginEmail(email, link);

    return {
      message: "Your sign-in link is ready. It works once, for 15 minutes.",
      // Development only: email isn't wired up yet, so show the link here.
      devLink: process.env.NODE_ENV !== "production" ? link : undefined,
    };
  } catch (err) {
    console.error("requestLoginLink failed", err);
    return { message: "We couldn't send a sign-in link right now. Please try again later." };
  }
}
