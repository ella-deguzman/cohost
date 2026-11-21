import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deletePhoto, getPhotoData } from "@/lib/photos";

/** Show a photo, but only to someone who belongs to its event. */
export async function GET(_req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });

  const { photoId } = await params;
  const data = await getPhotoData(photoId, user.id);
  if (!data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      // A photo never changes once saved, so the browser can keep it.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: "Request not allowed." }, { status: 403 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Your sign-in expired. Please sign in again." }, { status: 401 });

  const { photoId } = await params;
  const ok = await deletePhoto(photoId, user.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
