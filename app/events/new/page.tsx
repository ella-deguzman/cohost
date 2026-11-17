import PlannerForm from "@/components/PlannerForm";
import { requireUser } from "@/lib/auth";

export default async function NewEventPage() {
  await requireUser();
  return <PlannerForm />;
}
