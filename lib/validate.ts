import { cleanCollage, EMPTY_COLLAGE, type Collage } from "./collage";
import { cleanPlanChoices, EMPTY_PLAN, type PlanChoices } from "./plan";

// The details a host can save about an event. Everything is a string here because
// that is what form fields give us; validate() turns them into the right types.
export type EventInput = {
  title: string;
  description: string;
  eventDate: string; // "YYYY-MM-DD" or ""
  eventTime: string; // "HH:MM" or ""
  timeZone: string;
  location: string;
  headcount: string; // whole number or ""
  budget: string; // dollars, up to 2 decimals, or ""
  notes: string;
  collage: Collage; // the idea board: occasion, vibes and where each piece sits
  planChoices: PlanChoices; // what to plan: menu, shopping list, tasks
};

export const EMPTY_EVENT: EventInput = {
  title: "",
  description: "",
  eventDate: "",
  eventTime: "",
  timeZone: "",
  location: "",
  headcount: "",
  budget: "",
  notes: "",
  collage: EMPTY_COLLAGE,
  planChoices: EMPTY_PLAN,
};

export type CleanEvent = {
  title: string;
  description: string;
  eventDate: string | null;
  eventTime: string | null;
  timeZone: string | null;
  location: string;
  headcount: number | null;
  budget: string | null; // kept as text so money stays exact
  notes: string;
  collage: Collage;
  planChoices: PlanChoices;
};

export function validate(input: EventInput): { value: CleanEvent } | { error: string } {
  const title = input.title.trim();
  if (!title) return { error: "Give your event a name so we can save it." };
  if (title.length > 120) return { error: "Please keep the event name under 120 characters." };

  const description = input.description.trim();
  if (description.length > 1200) return { error: "The event description is too long (1,200 characters max)." };

  const notes = input.notes.trim();
  if (notes.length > 2000) return { error: "The notes are too long (2,000 characters max)." };

  const location = input.location.trim();
  if (location.length > 300) return { error: "The location is too long (300 characters max)." };

  let headcount: number | null = null;
  if (input.headcount.trim() !== "") {
    if (!/^\d{1,5}$/.test(input.headcount.trim())) return { error: "Enter the number of people as a whole number." };
    headcount = Number(input.headcount.trim());
    if (headcount < 1 || headcount > 10000) return { error: "The number of people must be between 1 and 10,000." };
  }

  let budget: string | null = null;
  if (input.budget.trim() !== "") {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input.budget.trim())) {
      return { error: "Enter the budget in dollars, like 300 or 300.50." };
    }
    budget = input.budget.trim();
  }

  let eventDate: string | null = null;
  if (input.eventDate.trim() !== "") {
    const d = input.eventDate.trim();
    const parsed = new Date(`${d}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) {
      return { error: "That date doesn't look right." };
    }
    eventDate = d;
  }

  let eventTime: string | null = null;
  if (input.eventTime.trim() !== "") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.eventTime.trim())) return { error: "That time doesn't look right." };
    eventTime = input.eventTime.trim();
  }

  const timeZone = input.timeZone.trim().slice(0, 64) || null;

  const collage = cleanCollage(input.collage);
  const planChoices = cleanPlanChoices(input.planChoices);

  return { value: { title, description, eventDate, eventTime, timeZone, location, headcount, budget, notes, collage, planChoices } };
}
