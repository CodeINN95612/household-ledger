"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  fundId: z.string().min(1),
  monthKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amountCents: z.number().int().min(0),
});

export async function recordContributionAction(
  fundId: string,
  monthKey: string,
  amountCents: number,
): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();

  const parsed = schema.safeParse({ fundId, monthKey, amountCents });
  if (!parsed.success) return { error: "Invalid input." };

  // Verify the fund exists and belongs to this user (personal) or is a couple fund
  const fund = await prisma.fund.findUnique({ where: { id: fundId } });
  if (!fund) return { error: "Fund not found." };
  if (fund.scope === "personal" && fund.ownerUserId !== user.id)
    return { error: "Not your fund." };

  // Upsert: if a contribution already exists for this fund+user+month, replace it
  const existing = await prisma.fundEntry.findFirst({
    where: { fundId, userId: user.id, monthKey, kind: "contribution" },
  });

  if (existing) {
    await prisma.fundEntry.update({
      where: { id: existing.id },
      data: { amountCents },
    });
  } else {
    await prisma.fundEntry.create({
      data: { fundId, userId: user.id, monthKey, amountCents, kind: "contribution" },
    });
  }

  revalidatePath(`/statement/${monthKey}`);
  return { ok: true };
}
