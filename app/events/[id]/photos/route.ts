import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MAX_PHOTOS } from "@/lib/collage";
import { MAX_PHOTO_BYTES, addPhoto } from "@/lib/photos";

/** A request from another website would carry a different Origin than this site. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === new URL(req.url).origin;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Upload one photo. The browser has already shrunk it to a JPEG. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return fail("Request not allowed.", 403);
  const user = await getCurrentUser();
  if (!user) return fail("Your sign-in expired. Please sign in again.", 401);

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_PHOTO_BYTES + 10_000) return fail("That photo is too big.", 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("We couldn't read that upload.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("No photo was sent.", 400);
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) return fail("That photo is too big.", 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  // Real JPEGs start with FF D8 FF. Anything else is refused, whatever its name says.
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return fail("Please add a photo.", 415);

  const dim = (v: FormDataEntryValue | null) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(4000, Math.max(1, n)) : 1000;
  };

  const { id } = await params;
  try {
    const photo = await addPhoto(id, user.id, bytes, dim(form.get("w")), dim(form.get("h")));
    if (!photo) return fail(`The board holds up to ${MAX_PHOTOS} photos, or this event isn't yours.`, 409);
    return NextResponse.json(photo);
  } catch (err) {
    console.error("photo upload failed", err);
    return fail("We couldn't save that photo. Please try again.", 500);
  }
}
