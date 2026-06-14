"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { parseDollarsToCents } from "@/lib/money";
import { z } from "zod";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

function revalidateFunds() {
  revalidatePath("/funds");
  revalidatePath("/statement", "layout");
}

// ── Create fund ───────────────────────────────────────────────────────────────

const createFundSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  scope: z.enum(["personal", "couple"]),
  targetCents: z.number().int().positive().nullable(),
  targetDate: z.coerce.date().nullable(),
  isPrivate: z.boolean(),
  isSinking: z.boolean(),
  sinkingNote: z.string().trim().max(200).nullable(),
});

export async function createFundAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const targetRaw = formData.get("targetAmount");
  const targetCents =
    targetRaw && String(targetRaw).trim() !== ""
      ? parseDollarsToCents(String(targetRaw))
      : null;

  const targetDateRaw = formData.get("targetDate");
  const targetDate =
    targetDateRaw && String(targetDateRaw).trim() !== ""
      ? new Date(String(targetDateRaw))
      : null;

  const parsed = createFundSchema.safeParse({
    name: formData.get("name"),
    scope: formData.get("scope"),
    targetCents: targetCents,
    targetDate,
    isPrivate:
      formData.get("scope") === "personal" &&
      (formData.get("isPrivate") === "on" || formData.get("isPrivate") === "true"),
    isSinking:
      formData.get("isSinking") === "on" || formData.get("isSinking") === "true",
    sinkingNote: formData.get("sinkingNote") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid fund details." };
  }

  const d = parsed.data;
  await prisma.fund.create({
    data: {
      name: d.name,
      scope: d.scope,
      ownerUserId: d.scope === "personal" ? user.id : null,
      targetCents: d.targetCents,
      targetDate: d.targetDate,
      isPrivate: d.scope === "personal" ? d.isPrivate : false,
      isSinking: d.isSinking,
      sinkingNote: d.sinkingNote,
    },
  });

  revalidateFunds();
  return { ok: true };
}

// ── Update fund ───────────────────────────────────────────────────────────────

export async function updateFundAction(
  fundId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const fund = await prisma.fund.findUnique({ where: { id: fundId } });
  if (!fund) return { error: "Fund not found." };
  if (fund.scope === "personal" && fund.ownerUserId !== user.id)
    return { error: "Not your fund." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const targetRaw = formData.get("targetAmount");
  const targetCents =
    targetRaw && String(targetRaw).trim() !== ""
      ? parseDollarsToCents(String(targetRaw))
      : null;

  const targetDateRaw = formData.get("targetDate");
  const targetDate =
    targetDateRaw && String(targetDateRaw).trim() !== ""
      ? new Date(String(targetDateRaw))
      : null;

  await prisma.fund.update({
    where: { id: fundId },
    data: {
      name,
      targetCents,
      targetDate,
      isSinking:
        formData.get("isSinking") === "on" || formData.get("isSinking") === "true",
      sinkingNote: String(formData.get("sinkingNote") ?? "").trim() || null,
      isPrivate:
        fund.scope === "personal" &&
        (formData.get("isPrivate") === "on" || formData.get("isPrivate") === "true"),
    },
  });

  revalidateFunds();
  revalidatePath(`/funds/${fundId}`);
  return { ok: true };
}

// ── Archive fund ──────────────────────────────────────────────────────────────

export async function archiveFundAction(fundId: string, _?: FormData): Promise<void> {
  const user = await requireUser();
  const fund = await prisma.fund.findUnique({ where: { id: fundId } });
  if (!fund || (fund.scope === "personal" && fund.ownerUserId !== user.id)) return;

  await prisma.fund.update({ where: { id: fundId }, data: { archived: true } });
  revalidateFunds();
}

// ── Allocation rule ───────────────────────────────────────────────────────────

const allocationRuleSchema = z.object({
  percentBps: z.number().int().min(0).max(10000),
  fixedCentsOverride: z.number().int().positive().nullable(),
});

export async function saveAllocationRuleAction(
  fundId: string,
  percentBps: number,
  fixedCentsOverride: number | null,
): Promise<ActionState> {
  const user = await requireUser();
  const fund = await prisma.fund.findUnique({ where: { id: fundId } });
  if (!fund) return { error: "Fund not found." };

  const parsed = allocationRuleSchema.safeParse({ percentBps, fixedCentsOverride });
  if (!parsed.success) return { error: "Invalid allocation." };

  await prisma.allocationRule.upsert({
    where: { userId_fundId: { userId: user.id, fundId } },
    update: {
      percentBps: parsed.data.percentBps,
      fixedCentsOverride: parsed.data.fixedCentsOverride,
      active: true,
    },
    create: {
      userId: user.id,
      fundId,
      percentBps: parsed.data.percentBps,
      fixedCentsOverride: parsed.data.fixedCentsOverride,
      active: true,
    },
  });

  revalidateFunds();
  revalidatePath(`/funds/${fundId}`);
  revalidatePath("/statement", "layout");
  return { ok: true };
}

// ── Record adjustment / withdrawal ───────────────────────────────────────────

const adjustmentSchema = z.object({
  fundId: z.string().min(1),
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amountCents: z.number().int().positive(),
  kind: z.enum(["withdrawal", "adjustment"]),
  note: z.string().trim().max(200).nullable(),
});

export async function recordAdjustmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const amountCents = parseDollarsToCents(String(formData.get("amount") ?? ""));

  const parsed = adjustmentSchema.safeParse({
    fundId: formData.get("fundId"),
    monthKey: formData.get("monthKey"),
    amountCents: amountCents ?? -1,
    kind: formData.get("kind"),
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid entry." };
  }

  const d = parsed.data;
  const fund = await prisma.fund.findUnique({ where: { id: d.fundId } });
  if (!fund) return { error: "Fund not found." };
  if (fund.scope === "personal" && fund.ownerUserId !== user.id)
    return { error: "Not your fund." };

  // Withdrawals are stored as negative amounts
  const storedAmount = d.kind === "withdrawal" ? -d.amountCents : d.amountCents;

  await prisma.fundEntry.create({
    data: {
      fundId: d.fundId,
      userId: user.id,
      monthKey: d.monthKey,
      amountCents: storedAmount,
      kind: d.kind,
      note: d.note,
    },
  });

  revalidateFunds();
  revalidatePath(`/funds/${d.fundId}`);
  return { ok: true };
}
