// What the host asked us to plan. Shared by the browser and the server.

export const MENU_KINDS = ["Full meal", "Snacks", "Drinks", "Dessert"] as const;

export type PlanChoices = {
  menu: boolean;
  menuKinds: string[]; // which kinds of menu, when menu is on
  shopping: boolean; // decor, supplies and food
  tasks: boolean;
};

export const EMPTY_PLAN: PlanChoices = { menu: false, menuKinds: [], shopping: false, tasks: false };

/** Turns anything the browser sends into safe plan choices. */
export function cleanPlanChoices(raw: unknown): PlanChoices {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const menuKinds: string[] = [];
  if (Array.isArray(o.menuKinds)) {
    for (const k of o.menuKinds) {
      if (typeof k === "string" && (MENU_KINDS as readonly string[]).includes(k) && !menuKinds.includes(k)) menuKinds.push(k);
    }
  }

  const menu = o.menu === true;
  return {
    menu,
    // A menu always has at least one kind, so there is never a menu with nothing in it.
    menuKinds: menu ? (menuKinds.length ? menuKinds : ["Full meal"]) : [],
    shopping: o.shopping === true,
    tasks: o.tasks === true,
  };
}

export const hasPlanChoices = (p: PlanChoices) => p.menu || p.shopping || p.tasks;
