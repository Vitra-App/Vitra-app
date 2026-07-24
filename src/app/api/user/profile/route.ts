import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { ageFromDOB, calcTargetsFromProfile } from '@/lib/nutrition';
import { profileTag } from '@/lib/data-cache';

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  sex: z.string().optional(),
  dateOfBirth: z.string().nullable().optional(),
  heightCm: z.number().nullable().optional(),
  weightKg: z.number().nullable().optional(),
  goal: z.enum(['lose_weight', 'maintain', 'gain_weight']).nullable().optional(),
  weeklyWeightChangeKg: z.number().nullable().optional(),
  activityLevel: z.string().optional(),
  caloricTarget: z.number().int().nullable().optional(),
  proteinTargetG: z.number().nullable().optional(),
  carbTargetG: z.number().nullable().optional(),
  fatTargetG: z.number().nullable().optional(),
  dietaryPrefs: z.array(z.string()).optional(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const userId = session.user.id;
  const { name, dateOfBirth, ...profileData } = parsed.data;

  if (name !== undefined) {
    await prisma.user.update({ where: { id: userId }, data: { name } });
  }

  const dob = dateOfBirth ? new Date(dateOfBirth) : null;

  // Merge incoming fields with whatever is already stored, then auto-derive
  // calorie + macro targets from the resulting profile. This ensures the
  // calorie target always reflects the user's current weight / sex / age / goal.
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  const merged = {
    sex: profileData.sex ?? existing?.sex ?? null,
    heightCm: profileData.heightCm ?? existing?.heightCm ?? null,
    weightKg: profileData.weightKg ?? existing?.weightKg ?? null,
    activityLevel: profileData.activityLevel ?? existing?.activityLevel ?? null,
    weeklyWeightChangeKg:
      profileData.weeklyWeightChangeKg !== undefined
        ? profileData.weeklyWeightChangeKg
        : existing?.weeklyWeightChangeKg ?? null,
    dateOfBirth: dob ?? existing?.dateOfBirth ?? null,
  };

  let derived: ReturnType<typeof calcTargetsFromProfile> | null = null;
  if (
    merged.sex &&
    merged.heightCm && merged.heightCm > 0 &&
    merged.weightKg && merged.weightKg > 0 &&
    merged.dateOfBirth
  ) {
    const age = ageFromDOB(merged.dateOfBirth);
    if (Number.isFinite(age) && age > 0) {
      derived = calcTargetsFromProfile({
        sex: merged.sex,
        ageYears: age,
        heightCm: merged.heightCm,
        weightKg: merged.weightKg,
        // Sensible defaults so calories compute even before activity/rate are set.
        activityLevel: merged.activityLevel || 'moderately_active',
        weeklyWeightChangeKg: merged.weeklyWeightChangeKg ?? 0,
      });
    }
  }

  // The user can only ever set a custom PROTEIN/CARB/FAT target -- the app never
  // lets them directly edit calories, so the server-derived calorie target always
  // wins. But if this request explicitly includes macro targets (i.e. the user
  // just chose a preset or typed custom grams/percentages in Edit Profile), those
  // MUST win over the auto-calculated formula values, otherwise every profile
  // save silently discards the user's chosen macros back to the 1.6-2.0g/kg
  // protein default. This was the bug: `...(derived ?? {})` used to unconditionally
  // overwrite proteinTargetG/carbTargetG/fatTargetG on every save.
  const clientProvidedMacros =
    profileData.proteinTargetG !== undefined ||
    profileData.carbTargetG !== undefined ||
    profileData.fatTargetG !== undefined;

  const finalData = {
    ...profileData,
    dateOfBirth: dob,
    ...(derived
      ? {
          caloricTarget: derived.caloricTarget,
          ...(clientProvidedMacros
            ? {}
            : {
                proteinTargetG: derived.proteinTargetG,
                carbTargetG: derived.carbTargetG,
                fatTargetG: derived.fatTargetG,
              }),
        }
      : {}),
  };

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: finalData,
    create: { userId, ...finalData },
  });

  revalidateTag(profileTag(userId));
  revalidateTag(`user-${userId}`);

  return NextResponse.json(profile);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json(profile);
}

// ── DELETE /api/user/profile  (delete account) ────────────────────────────────
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  // Cascade delete via Prisma (relies on schema onDelete: Cascade)
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
