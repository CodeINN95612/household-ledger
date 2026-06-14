"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export interface SettingsActionState {
  error?: string;
  ok?: boolean;
}

export async function updateHouseholdSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const frontingUserId = formData.get("frontingUserId")?.toString().trim() || null;
  const horizonRaw = parseInt(formData.get("projectionHorizonMonths")?.toString() ?? "12", 10);
  const projectionHorizonMonths = [6, 12, 18, 24].includes(horizonRaw) ? horizonRaw : 12;
  const coupleGoalSplitMode = formData.get("coupleGoalSplitMode")?.toString() === "equal"
    ? "equal"
    : "proportional";
  const floatOverrideRaw = formData.get("floatReserveCentsOverride")?.toString().trim();
  const floatReserveCentsOverride =
    floatOverrideRaw
      ? Math.round(parseFloat(floatOverrideRaw.replace(/,/g, "")) * 100) || null
      : null;

  await prisma.householdSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      frontingUserId,
      projectionHorizonMonths,
      coupleGoalSplitMode,
      floatReserveCentsOverride,
    },
    update: { frontingUserId, projectionHorizonMonths, coupleGoalSplitMode, floatReserveCentsOverride },
  });

  revalidatePath("/settings");
  revalidatePath("/plan");
  revalidatePath("/health");
  return { ok: true };
}