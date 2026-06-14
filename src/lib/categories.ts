export const EXPENSE_CATEGORIES = [
  "groceries",
  "dining",
  "utilities",
  "transport",
  "healthcare",
  "entertainment",
  "home",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
