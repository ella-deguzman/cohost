import { notFound } from "next/navigation";
import PlannerForm from "@/components/PlannerForm";
import { requireUser } from "@/lib/auth";
import { getEvent, rowToInput } from "@/lib/events";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  // Returns null unless this person is a member of the event, so other people's
  // events look exactly like events that don't exist.
  const event = await getEvent(id, user.id);
  if (!event) notFound();

  return <PlannerForm initial={{ id: event.id, version: event.plan_version, input: rowToInput(event) }} />;
}
