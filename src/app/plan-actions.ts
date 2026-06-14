"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import type { ScenarioOverrides } from "@/lib/data";

export async function saveScenarioAction(
  _prev: { error?: string; ok?: string },
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name")?.toString().trim();
  if (!name) return { error: "Name is required" };

  const overridesJson = formData.get("overridesJson")?.toString() ?? "{}";
  try { JSON.parse(overridesJson); } catch { return { error: "Invalid overrides" }; }

  await prisma.scenario.create({
    data: { name, createdByUserId: user.id, baseline: false, overridesJson },
  });

  revalidatePath("/plan");
  return { ok: "Scenario saved." };
}

export async function promoteScenarioAction(scenarioId: string, _: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) return;

  let overrides: ScenarioOverrides = {};
  try { overrides = JSON.parse(scenario.overridesJson) as ScenarioOverrides; } catch {}

  await prisma.$transaction(async (tx) => {
    await tx.scenario.updateMany({ data: { baseline: false } });
    await tx.scenario.update({ where: { id: scenarioId }, data: { baseline: true } });

    if (overrides.allocationRuleOverrides?.length) {
      for (const r of overrides.allocationRuleOverrides) {
        await tx.allocationRule.upsert({
          where: { userId_fundId: { userId: r.userId, fundId: r.fundId } },
          create: {
            userId: r.userId,
            fundId: r.fundId,
            percentBps: r.percentBps,
            fixedCentsOverride: r.fixedCentsOverride,
            active: true,
          },
          update: { percentBps: r.percentBps, fixedCentsOverride: r.fixedCentsOverride },
        });
      }
    }
  });

  revalidatePath("/plan");
}

export async function deleteScenarioAction(scenarioId: string, _: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
  if (!scenario || scenario.baseline) return;

  await prisma.scenario.delete({ where: { id: scenarioId } });
  revalidatePath("/plan");
}

export async function savePlanAssumptionAction(
  _prev: { error?: string; ok?: string },
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const kind = formData.get("kind")?.toString();
  const monthKey = formData.get("monthKey")?.toString() || null;
  const amountRaw = formData.get("amountCents")?.toString().trim() ?? "";
  const note = formData.get("note")?.toString().trim() || null;

  if (!kind) return { error: "Kind is required" };
  const amountCents = Math.round(parseFloat(amountRaw.replace(/,/g, "")) * 100);
  if (isNaN(amountCents)) return { error: "Invalid amount" };

  const existing = await prisma.planAssumption.findFirst({
    where: { userId: user.id, kind, monthKey },
  });
  if (existing) {
    await prisma.planAssumption.update({
      where: { id: existing.id },
      data: { amountCents, note, updatedAt: new Date() },
    });
  } else {
    await prisma.planAssumption.create({
      data: { userId: user.id, kind, monthKey, amountCents, note },
    });
  }

  revalidatePath("/plan");
  return { ok: "Saved." };
}

export async function deletePlanAssumptionAction(assumptionId: string, _?: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const existing = await prisma.planAssumption.findUnique({ where: { id: assumptionId } });
  if (!existing || existing.userId !== user.id) return;

  await prisma.planAssumption.delete({ where: { id: assumptionId } });
  revalidatePath("/plan");
}

export async function updateProjectionHorizonAction(months: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.householdSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", projectionHorizonMonths: months },
    update: { projectionHorizonMonths: months },
  });

  revalidatePath("/plan");
}
