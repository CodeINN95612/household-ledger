"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { expenseInputSchema, incomeInputSchema } from "@/lib/validation";
import { parseDollarsToCents } from "@/lib/money";
import { monthKeyForDate } from "@/lib/month";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

function revalidateMonth(monthKey: string) {
  revalidatePath(`/month/${monthKey}`);
  revalidatePath("/history");
  revalidatePath("/");
}

function readExpenseForm(formData: FormData) {
  const dateStr = String(formData.get("date") ?? "");
  const amountCents = parseDollarsToCents(String(formData.get("amount") ?? ""));
  return expenseInputSchema.safeParse({
    date: dateStr,
    description: formData.get("description"),
    amountCents: amountCents ?? -1, // force a validation failure on bad input
    type: formData.get("type"),
    paidByUserId: formData.get("paidByUserId"),
  });
}

export async function createExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = readExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid expense." };
  }
  const data = parsed.data;
  const monthKey = monthKeyForDate(data.date);
  await prisma.expense.create({
    data: {
      date: data.date,
      monthKey,
      description: data.description,
      amountCents: data.amountCents,
      type: data.type,
      paidByUserId: data.paidByUserId,
    },
  });
  revalidateMonth(monthKey);
  return { ok: true };
}

export async function updateExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return { error: "Expense not found." };

  const parsed = readExpenseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid expense." };
  }
  const data = parsed.data;
  const monthKey = monthKeyForDate(data.date);
  await prisma.expense.update({
    where: { id },
    data: {
      date: data.date,
      monthKey,
      description: data.description,
      amountCents: data.amountCents,
      type: data.type,
      paidByUserId: data.paidByUserId,
    },
  });
  revalidateMonth(monthKey);
  if (existing.monthKey !== monthKey) revalidateMonth(existing.monthKey);
  return { ok: true };
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.expense.delete({ where: { id } });
  revalidateMonth(existing.monthKey);
}

export async function saveIncomeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const amountCents = parseDollarsToCents(String(formData.get("amount") ?? ""));
  const parsed = incomeInputSchema.safeParse({
    monthKey: formData.get("monthKey"),
    amountCents: amountCents ?? -1,
    isPrivate: formData.get("isPrivate") === "on" || formData.get("isPrivate") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid income." };
  }
  const data = parsed.data;

  // A user may only ever write their OWN income (privacy + integrity).
  await prisma.income.upsert({
    where: { userId_monthKey: { userId: user.id, monthKey: data.monthKey } },
    update: { amountCents: data.amountCents, isPrivate: data.isPrivate },
    create: {
      userId: user.id,
      monthKey: data.monthKey,
      amountCents: data.amountCents,
      isPrivate: data.isPrivate,
    },
  });
  revalidateMonth(data.monthKey);
  return { ok: true };
}
