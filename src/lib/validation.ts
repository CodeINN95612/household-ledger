import { z } from "zod";
import { isValidMonthKey } from "./month";

export const EXPENSE_TYPES = ["shared", "personal"] as const;

const monthKey = z.string().refine(isValidMonthKey, {
  message: "monthKey must be in YYYY-MM form",
});

const amountCents = z
  .number()
  .int("Amount must be in whole cents")
  .nonnegative("Amount cannot be negative");

export const expenseInputSchema = z.object({
  date: z.coerce.date(),
  description: z.string().trim().min(1, "Description is required").max(200),
  amountCents: amountCents.refine((c) => c > 0, "Amount must be greater than zero"),
  type: z.enum(EXPENSE_TYPES),
  paidByUserId: z.string().min(1),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const incomeInputSchema = z.object({
  monthKey,
  amountCents,
  isPrivate: z.boolean(),
});

export type IncomeInput = z.infer<typeof incomeInputSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
