/**
 * Stable per-person identity colors. The first member (by id) is always color
 * "a" (indigo), the second "b" (ochre) — so each partner reads as the same color
 * for both viewers. This is attribution, not decoration.
 */
export type PersonColor = "a" | "b";

export function buildColorMap(memberIdsSorted: string[]): Map<string, PersonColor> {
  const map = new Map<string, PersonColor>();
  memberIdsSorted.forEach((id, index) => {
    map.set(id, index === 0 ? "a" : "b");
  });
  return map;
}

export const personClasses: Record<
  PersonColor,
  { text: string; bg: string; dot: string; border: string }
> = {
  a: {
    text: "text-person-a",
    bg: "bg-person-a-soft",
    dot: "bg-person-a",
    border: "border-person-a",
  },
  b: {
    text: "text-person-b",
    bg: "bg-person-b-soft",
    dot: "bg-person-b",
    border: "border-person-b",
  },
};
