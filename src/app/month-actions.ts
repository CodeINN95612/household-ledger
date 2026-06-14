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

function parseIsRecurringFixed(formData: FormData): boolean | null {
  const raw = formData.get("isRecurringFixed")?.toString();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
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

  // If installments > 1, create a FinancedExpense instead of a regular Expense
  const installmentsRaw = String(formData.get("installments") ?? "").trim();
  const installments = installmentsRaw ? parseInt(installmentsRaw, 10) : 1;
  if (installments > 1) {
    if (!Number.isInteger(installments) || installments < 2 || installments > 120) {
      return { error: "Installments must be between 2 and 120." };
    }
    const rateRaw = String(formData.get("annualRate") ?? "").trim();
    const ratePct = rateRaw ? parseFloat(rateRaw) : 0;
    if (isNaN(ratePct) || ratePct < 0 || ratePct > 100) {
      return { error: "Annual interest rate must be between 0 and 100." };
    }
    const annualRateBps = Math.round(ratePct * 100);
    const category = String(formData.get("category") ?? "").trim() || null;
    await prisma.financedExpense.create({
      data: {
        description: data.description,
        totalCents: data.amountCents,
        installments,
        annualRateBps,
        startMonthKey: monthKey,
        type: data.type,
        paidByUserId: data.paidByUserId,
        category,
      },
    });
    revalidateMonth(monthKey);
    return { ok: true };
  }

  const category = String(formData.get("category") ?? "").trim() || null;
  const isRecurringFixed = parseIsRecurringFixed(formData);
  await prisma.expense.create({
    data: {
      date: data.date,
      monthKey,
      description: data.description,
      amountCents: data.amountCents,
      type: data.type,
      paidByUserId: data.paidByUserId,
      category,
      isRecurringFixed,
    },
  });
  revalidateMonth(monthKey);
  return { ok: true };
}

export async function cancelFinancedExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.financedExpense.findUnique({ where: { id } });
  if (!existing || existing.cancelledAt) return;
  await prisma.financedExpense.update({ where: { id }, data: { cancelledAt: new Date() } });
  revalidatePath("/month", "layout");
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
  const category = String(formData.get("category") ?? "").trim() || null;
  const isRecurringFixed = parseIsRecurringFixed(formData);
  await prisma.expense.update({
    where: { id },
    data: {
      date: data.date,
      monthKey,
      description: data.description,
      amountCents: data.amountCents,
      type: data.type,
      paidByUserId: data.paidByUserId,
      category,
      isRecurringFixed,
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

export async function tagExpenseAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const categoryRaw = formData.get("category")?.toString().trim();
  const category = categoryRaw || null;

  // Try regular expense first
  const existing = await prisma.expense.findUnique({ where: { id }, select: { monthKey: true } });
  if (existing) {
    const recurringRaw = formData.get("isRecurringFixed")?.toString();
    const isRecurringFixed =
      recurringRaw === "true" ? true : recurringRaw === "false" ? false : null;
    await prisma.expense.update({ where: { id }, data: { category, isRecurringFixed } });
    revalidateMonth(existing.monthKey);
    revalidatePath("/plan");
    revalidatePath("/health");
    return;
  }

  // Fall back to financed expense (only category is editable; recurring is always fixed)
  const financed = await prisma.financedExpense.findUnique({ where: { id } });
  if (financed) {
    await prisma.financedExpense.update({ where: { id }, data: { category } });
    revalidatePath("/month", "layout");
  }
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
