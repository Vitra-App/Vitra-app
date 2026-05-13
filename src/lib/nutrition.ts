/**
 * Nutrition calculation utilities.
 */

export function calcBMR(
  sex: string,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  // Mifflin-St Jeor equation
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'female' ? base - 161 : base + 5;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

export function calcTDEE(bmr: number, activityLevel: string): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55));
}

export function ageFromDOB(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function macroPercent(calories: number, grams: number, kcalPerG: number): number {
  if (calories === 0) return 0;
  return Math.round((grams * kcalPerG * 100) / calories);
}

const KCAL_PER_KG_BODY_FAT = 7700;

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface ProfileTargetInputs {
  sex: string;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  /** Signed kg/week. Negative = lose, positive = gain, 0/null = maintain. */
  weeklyWeightChangeKg: number | null;
}

export interface ComputedTargets {
  caloricTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
}

/**
 * Compute daily calorie + macro targets from a user's basic profile.
 * - Calories: TDEE + (weekly kg change × 7700 ÷ 7), floored at a safe minimum.
 * - Protein: 2.0 g/kg if cutting, 1.8 g/kg if bulking, 1.6 g/kg if maintaining.
 * - Fat: 25% of calories.
 * - Carbs: remaining calories.
 */
export function calcTargetsFromProfile(p: ProfileTargetInputs): ComputedTargets {
  const bmr = calcBMR(p.sex, p.weightKg, p.heightCm, p.ageYears);
  const tdee = calcTDEE(bmr, p.activityLevel);
  const dailyDelta = ((p.weeklyWeightChangeKg ?? 0) * KCAL_PER_KG_BODY_FAT) / 7;
  const minCalories = p.sex === 'female' ? 1200 : 1500;
  const calories = Math.max(minCalories, Math.round(tdee + dailyDelta));

  const proteinPerKg =
    p.weeklyWeightChangeKg != null && p.weeklyWeightChangeKg < 0
      ? 2.0
      : p.weeklyWeightChangeKg != null && p.weeklyWeightChangeKg > 0
        ? 1.8
        : 1.6;
  const proteinG = roundTo(p.weightKg * proteinPerKg, 5);

  const fatG = roundTo((calories * 0.25) / 9, 5);

  const remainingKcal = calories - proteinG * 4 - fatG * 9;
  const carbG = Math.max(0, roundTo(remainingKcal / 4, 5));

  return {
    caloricTarget: roundTo(calories, 10),
    proteinTargetG: proteinG,
    carbTargetG: carbG,
    fatTargetG: fatG,
  };
}

export interface DailyNutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  vitaminDMcg?: number;
  calciumMg?: number;
  ironMg?: number;
}

export interface DailyTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyScore {
  /** 0–10, one decimal. */
  score: number;
  /** A short qualitative label (e.g. "Excellent", "Good"). */
  label: string;
  /** Per-component breakdown for tooltips/UI. */
  breakdown: {
    name: string;
    score: number;
    max: number;
    note: string;
  }[];
}

/**
 * Score a day's nutrition vs. the user's targets, out of 10.
 * Components (max points):
 *  - Calorie adherence (3): full credit within ±10% of target.
 *  - Protein hit       (2.5): full credit at ≥95% of target, scaled below.
 *  - Fiber             (1.5): full credit at ≥25 g.
 *  - Sodium            (1.5): full credit if ≤2300 mg, zero at ≥3500 mg.
 *  - Macro balance     (1.5): full credit if both carbs and fat are within
 *                              60–115% of target.
 * Days with no logged calories return a score of 0.
 */
export function calcDailyScore(
  totals: DailyNutritionTotals,
  targets: DailyTargets,
): DailyScore {
  const breakdown: DailyScore['breakdown'] = [];

  // Calories: 3 pts. Linear falloff outside ±10%, zero past ±40%.
  let calPts = 0;
  if (targets.calories > 0) {
    const ratio = totals.calories / targets.calories;
    const dev = Math.abs(ratio - 1);
    if (dev <= 0.1) calPts = 3;
    else if (dev >= 0.4) calPts = 0;
    else calPts = 3 * (1 - (dev - 0.1) / 0.3);
  }
  breakdown.push({
    name: 'Calories',
    score: round1(calPts),
    max: 3,
    note:
      targets.calories > 0
        ? `${Math.round(totals.calories)} / ${targets.calories} kcal`
        : 'no target',
  });

  // Protein: 2.5 pts. Linear from 0 at 0% to full at 95%+; cap at 1.0 over.
  let protPts = 0;
  if (targets.proteinG > 0) {
    const ratio = Math.min(1, totals.proteinG / (targets.proteinG * 0.95));
    protPts = 2.5 * Math.max(0, ratio);
  }
  breakdown.push({
    name: 'Protein',
    score: round1(protPts),
    max: 2.5,
    note: `${Math.round(totals.proteinG)} / ${Math.round(targets.proteinG)} g`,
  });

  // Fiber: 1.5 pts. Full at 25 g.
  const fiberTarget = 25;
  const fiberPts = 1.5 * Math.min(1, totals.fiberG / fiberTarget);
  breakdown.push({
    name: 'Fiber',
    score: round1(fiberPts),
    max: 1.5,
    note: `${Math.round(totals.fiberG)} / ${fiberTarget} g`,
  });

  // Sodium: 1.5 pts. Full if ≤2300 mg, zero at ≥3500 mg.
  let sodPts = 0;
  if (totals.sodiumMg <= 2300) sodPts = 1.5;
  else if (totals.sodiumMg >= 3500) sodPts = 0;
  else sodPts = 1.5 * (1 - (totals.sodiumMg - 2300) / 1200);
  breakdown.push({
    name: 'Sodium',
    score: round1(sodPts),
    max: 1.5,
    note: `${Math.round(totals.sodiumMg)} mg (≤2300)`,
  });

  // Macro balance: 1.5 pts. Full when both carbs and fat are 60–115% of target.
  let macroPts = 0;
  if (targets.carbsG > 0 && targets.fatG > 0) {
    const cRatio = totals.carbsG / targets.carbsG;
    const fRatio = totals.fatG / targets.fatG;
    const inRange = (r: number) => r >= 0.6 && r <= 1.15;
    if (inRange(cRatio) && inRange(fRatio)) macroPts = 1.5;
    else if (inRange(cRatio) || inRange(fRatio)) macroPts = 0.75;
  }
  breakdown.push({
    name: 'Macro balance',
    score: round1(macroPts),
    max: 1.5,
    note: `C ${Math.round(totals.carbsG)} / ${Math.round(targets.carbsG)} g · F ${Math.round(totals.fatG)} / ${Math.round(targets.fatG)} g`,
  });

  let total = calPts + protPts + fiberPts + sodPts + macroPts;
  // No food logged → no score.
  if (totals.calories <= 0) total = 0;

  const score = Math.max(0, Math.min(10, round1(total)));

  let label: string;
  if (totals.calories <= 0) label = 'No data yet';
  else if (score >= 9) label = 'Excellent';
  else if (score >= 7.5) label = 'Great';
  else if (score >= 6) label = 'Good';
  else if (score >= 4) label = 'Okay';
  else label = 'Needs work';

  return { score, label, breakdown };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

