/**
 * AI service functions.
 *
 * When OPENAI_API_KEY is set, real OpenAI calls are made.
 * Otherwise, mock responses are returned so the app works without credentials.
 */

import type { UserProfile, BloodworkMarker } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyLog {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  vitaminDMcg: number;
  ironMg: number;
  calciumMg: number;
}

export interface WeeklyTrends {
  avgCalories: number;
  avgProteinG: number;
  daysUnderProteinTarget: number;
  daysLogged: number;
}

export interface MealPhotoAnalysis {
  items: Array<{
    name: string;
    estimatedServingSize: string;
    quantity: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
    cholesterolMg: number;
    saturatedFatG: number;
    potassiumMg: number;
    vitaminDMcg: number;
    calciumMg: number;
    ironMg: number;
  }>;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  confidenceScore: number; // 0–1
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 600,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content ?? '';
}

// ── generateDailyNutritionOutlook ─────────────────────────────────────────────

export async function generateDailyNutritionOutlook(
  profile: Pick<UserProfile, 'goal' | 'caloricTarget' | 'proteinTargetG' | 'carbTargetG' | 'fatTargetG'> | null,
  dailyLog: DailyLog,
  weeklyTrends: WeeklyTrends,
  bloodwork: BloodworkMarker[],
  foodsEaten: Array<{ mealType: string; name: string; calories: number; servingCount: number }> = [],
): Promise<string> {
  if (!hasOpenAIKey()) {
    return generateMockDailyOutlook(profile, dailyLog, weeklyTrends);
  }

  const calPct = profile?.caloricTarget ? Math.round((dailyLog.calories / profile.caloricTarget) * 100) : null;
  const protPct = profile?.proteinTargetG ? Math.round((dailyLog.proteinG / profile.proteinTargetG) * 100) : null;

  const mealSummary = foodsEaten.length > 0
    ? foodsEaten.map(f => `${f.mealType}: ${f.name} (${f.calories} kcal)`).join('\n')
    : 'Nothing logged yet today';

  const bloodworkSummary = bloodwork.length > 0
    ? bloodwork.map((b) => `${b.markerName}: ${b.value} ${b.unit}`).join(', ')
    : null;

  const system = `You are a personal nutrition coach reviewing someone's actual food log. 
Write 3 short, direct observations about what they actually ate today — reference the real foods by name.
Rules:
- Reference specific foods they logged (e.g. "The bagels gave you..." not "Your carb intake...") 
- Keep each point to one sentence, max 15 words
- Do not start any point with "You" — vary the sentence openers
- Do not use the word "ensuring", "optimize", "crucial", "prioritize", "intake", or "overall"
- No generic nutrition advice that could apply to anyone
- If nothing was logged, just note the day is still early
- Format: exactly 3 bullet points, each starting with a single relevant emoji then a space
- No headers, no bold, no numbered lists`;

  const user = `Goal: ${profile?.goal ?? 'maintain'}
Calorie target: ${profile?.caloricTarget ?? 2000} kcal | Eaten: ${dailyLog.calories} kcal${calPct !== null ? \` (${calPct}%)\` : ''}
Protein target: ${profile?.proteinTargetG ?? 150}g | Eaten: ${dailyLog.proteinG}g${protPct !== null ? \` (${protPct}%)\` : ''}
Carbs: ${dailyLog.carbsG}g | Fat: ${dailyLog.fatG}g | Fiber: ${dailyLog.fiberG}g

What they actually ate today:
${mealSummary}

Weekly context: avg ${weeklyTrends.avgCalories} kcal/day, ${weeklyTrends.daysLogged} days logged this week${bloodworkSummary ? \`\nBloodwork: \${bloodworkSummary}\` : ''}`;

  return callOpenAI(system, user);
}

function generateMockDailyOutlook(
  profile: Pick<UserProfile, 'goal' | 'caloricTarget' | 'proteinTargetG'> | null,
  dailyLog: DailyLog,
  weekly: WeeklyTrends,
): string {
  const insights: string[] = [];

  const calTarget = profile?.caloricTarget ?? 2000;
  const calDiff = dailyLog.calories - calTarget;
  if (calDiff < -300) {
    insights.push(`Your calorie intake today (${dailyLog.calories} kcal) is notably below your target. Make sure you're eating enough to support your energy and recovery.`);
  } else if (calDiff > 300) {
    insights.push(`You're tracking above your calorie target today. Consider whether an extra snack or larger portions were intentional.`);
  } else {
    insights.push(`You're on track with your calorie goal today — great consistency!`);
  }

  const protTarget = profile?.proteinTargetG ?? 120;
  if (dailyLog.proteinG < protTarget * 0.8) {
    insights.push(`Protein intake (${dailyLog.proteinG}g) is below your target of ${protTarget}g. Adding a protein-rich food like Greek yogurt, eggs, or chicken could help.`);
  }

  if (weekly.daysUnderProteinTarget >= 4) {
    insights.push(`Your protein has been below target ${weekly.daysUnderProteinTarget} of the last 7 days. Consistent protein intake supports muscle maintenance and satiety.`);
  }

  if (dailyLog.fiberG < 20) {
    insights.push(`Your fiber intake looks low compared to general guidelines (25–38g/day). Adding vegetables, legumes, or whole grains can help.`);
  }

  if (dailyLog.vitaminDMcg < 10) {
    insights.push(`Vitamin D from food today appears low. Fatty fish, fortified milk, and eggs are good dietary sources.`);
  }

  return insights.join('\n\n');
}

// ── generateWeeklySummary ─────────────────────────────────────────────────────

export interface WeeklyDaySummary {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
}

export async function generateWeeklySummary(
  profile: Pick<UserProfile, 'goal' | 'caloricTarget' | 'proteinTargetG' | 'carbTargetG' | 'fatTargetG'> | null,
  days: WeeklyDaySummary[],
): Promise<string> {
  const daysLogged = days.filter((d) => d.calories > 0);

  if (daysLogged.length < 2) {
    return 'Log at least 2 days this week to generate a weekly summary.';
  }

  if (!hasOpenAIKey()) {
    return generateMockWeeklySummary(profile, days);
  }

  const system = `You are a friendly nutrition coach writing a weekly check-in summary.
Be concise, specific, and motivating. No fluff.
Respond with 4–6 bullet points (emoji + one sentence each). No headers, no bold, no numbered lists.`;

  const avgCal = Math.round(daysLogged.reduce((s, d) => s + d.calories, 0) / daysLogged.length);
  const avgProt = Math.round(daysLogged.reduce((s, d) => s + d.proteinG, 0) / daysLogged.length);
  const avgFiber = Math.round(daysLogged.reduce((s, d) => s + d.fiberG, 0) / daysLogged.length);
  const avgSodium = Math.round(daysLogged.reduce((s, d) => s + d.sodiumMg, 0) / daysLogged.length);

  const user = `Goal: ${profile?.goal ?? 'not set'}
Caloric target: ${profile?.caloricTarget ?? 'not set'} kcal/day
Protein target: ${profile?.proteinTargetG ?? 'not set'}g/day

This week (${daysLogged.length}/7 days logged):
- Avg calories: ${avgCal} kcal
- Avg protein: ${avgProt}g
- Avg fiber: ${avgFiber}g
- Avg sodium: ${avgSodium}mg

Daily breakdown:
${days.map((d) => `${d.date}: ${d.calories > 0 ? `${Math.round(d.calories)} kcal, ${Math.round(d.proteinG)}g protein` : 'not logged'}`).join('\n')}

Write a weekly nutrition summary with actionable insights.`;

  return callOpenAI(system, user);
}

function generateMockWeeklySummary(
  profile: Pick<UserProfile, 'goal' | 'caloricTarget' | 'proteinTargetG'> | null,
  days: WeeklyDaySummary[],
): string {
  const logged = days.filter((d) => d.calories > 0);
  const avgCal = Math.round(logged.reduce((s, d) => s + d.calories, 0) / (logged.length || 1));
  const avgProt = Math.round(logged.reduce((s, d) => s + d.proteinG, 0) / (logged.length || 1));
  const target = profile?.caloricTarget ?? 2000;
  const protTarget = profile?.proteinTargetG ?? 120;

  const lines: string[] = [];
  lines.push(
    avgCal > target + 200
      ? `📈 You averaged ${avgCal} kcal/day this week — slightly above your ${target} kcal target. Watch portions on high-calorie days.`
      : avgCal < target - 300
      ? `📉 Average calories (${avgCal} kcal) were below target — ensure you're eating enough to fuel your goals.`
      : `✅ Solid week — your average of ${avgCal} kcal/day was close to your ${target} kcal target.`,
  );

  const protDays = logged.filter((d) => d.proteinG >= protTarget * 0.8).length;
  lines.push(
    protDays >= logged.length * 0.7
      ? `💪 Protein was on target ${protDays}/${logged.length} days — great consistency.`
      : `🥩 Protein hit target only ${protDays}/${logged.length} days. Prioritise a protein source at every meal.`,
  );

  const avgFiber = Math.round(logged.reduce((s, d) => s + d.fiberG, 0) / (logged.length || 1));
  lines.push(
    avgFiber < 20
      ? `🥦 Fiber averaged ${avgFiber}g/day — below the 25–38g guideline. Add more vegetables, legumes, or whole grains.`
      : `🥦 Great fiber intake this week (avg ${avgFiber}g/day).`,
  );

  const avgSodium = Math.round(logged.reduce((s, d) => s + d.sodiumMg, 0) / (logged.length || 1));
  if (avgSodium > 2500) {
    lines.push(`🧂 Sodium averaged ${avgSodium}mg/day — above the 2,300mg limit. Limit processed foods and added salt.`);
  }

  lines.push(`📅 You logged ${logged.length}/7 days. ${logged.length >= 5 ? 'Excellent tracking discipline!' : 'Try to log every day for the most accurate insights.'}`);

  return lines.join('\n');
}

// ── analyzeMealPhoto ──────────────────────────────────────────────────────────

export async function analyzeMealPhoto(
  base64Image: string,
  mimeType: string = 'image/jpeg',
  description?: string,
): Promise<MealPhotoAnalysis> {
  if (!hasOpenAIKey()) {
    return getMockMealPhotoAnalysis();
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userText = description
    ? `The user says: "${description}". Analyse this meal and return the JSON.`
    : 'Analyse this meal and return the JSON.';

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a nutrition analysis assistant. When given a meal photo, identify each DISTINCT food item, estimate portion sizes, and return a JSON object with the following structure:
{
  "items": [{ "name": "", "estimatedServingSize": "", "quantity": 1, "calories": 0, "proteinG": 0, "carbsG": 0, "fatG": 0, "fiberG": 0, "sugarG": 0, "sodiumMg": 0, "cholesterolMg": 0, "saturatedFatG": 0, "potassiumMg": 0, "vitaminDMcg": 0, "calciumMg": 0, "ironMg": 0 }],
  "totalCalories": 0,
  "totalProteinG": 0,
  "totalCarbsG": 0,
  "totalFatG": 0,
  "confidenceScore": 0.0,
  "notes": ""
}
IMPORTANT: Group identical items — for example, 4 slices of pizza should be ONE item with quantity=4, NOT four separate items. The calories/protein/carbs/fat/fiber/sugar/sodium/cholesterol/saturatedFat/potassium/vitaminD/calcium/iron fields represent the values for ONE unit of the estimatedServingSize. Estimate ALL nutrient fields as best you can — use typical nutritional database values for the identified food and portion size. Be conservative with estimates. Use any description provided by the user to improve accuracy. Confidence score should reflect image clarity and identifiability.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'low' },
          },
          { type: 'text', text: userText },
        ],
      },
    ],
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as MealPhotoAnalysis;
}

function getMockMealPhotoAnalysis(): MealPhotoAnalysis {
  return {
    items: [
      { name: 'Grilled Chicken Breast', estimatedServingSize: '150g', quantity: 1, calories: 248, proteinG: 46, carbsG: 0, fatG: 5.4, fiberG: 0, sugarG: 0, sodiumMg: 74, cholesterolMg: 125, saturatedFatG: 1.5, potassiumMg: 440, vitaminDMcg: 0.1, calciumMg: 15, ironMg: 1.1 },
      { name: 'Brown Rice', estimatedServingSize: '1 cup', quantity: 1, calories: 216, proteinG: 5, carbsG: 45, fatG: 1.8, fiberG: 3.5, sugarG: 0.7, sodiumMg: 10, cholesterolMg: 0, saturatedFatG: 0.4, potassiumMg: 154, vitaminDMcg: 0, calciumMg: 20, ironMg: 1.0 },
      { name: 'Steamed Broccoli', estimatedServingSize: '1 cup', quantity: 1, calories: 55, proteinG: 3.7, carbsG: 11, fatG: 0.6, fiberG: 5.1, sugarG: 2.6, sodiumMg: 64, cholesterolMg: 0, saturatedFatG: 0.1, potassiumMg: 457, vitaminDMcg: 0, calciumMg: 62, ironMg: 1.1 },
    ],
    totalCalories: 519,
    totalProteinG: 54.7,
    totalCarbsG: 56,
    totalFatG: 7.8,
    confidenceScore: 0.72,
    notes: 'Mock analysis — add an OpenAI API key for real photo analysis.',
  };
}

// ── generateBloodworkSummary ──────────────────────────────────────────────────

export async function generateBloodworkSummary(
  profile: Pick<UserProfile, 'sex' | 'goal'> | null,
  markers: BloodworkMarker[],
): Promise<string> {
  const disclaimer =
    '⚠️ **Disclaimer:** This is not medical advice. These are general educational observations only. Always review your lab results with a licensed healthcare professional.';

  if (markers.length === 0) {
    return `${disclaimer}\n\nNo bloodwork markers have been entered yet.`;
  }

  if (!hasOpenAIKey()) {
    return `${disclaimer}\n\n${generateMockBloodworkSummary(markers)}`;
  }

  const system = `You are a health-education assistant providing general, educational commentary on bloodwork values.
NEVER diagnose disease, NEVER recommend specific medications, and ALWAYS remind users to consult their healthcare provider.
Use hedging language: "may", "could", "consider discussing with your clinician".
Keep the response under 300 words. Start with the disclaimer provided by the system.`;

  const markerList = markers
    .map(
      (m) =>
        `${m.markerName}: ${m.value} ${m.unit}` +
        (m.referenceMin != null && m.referenceMax != null
          ? ` (reference range: ${m.referenceMin}–${m.referenceMax} ${m.unit})`
          : ''),
    )
    .join('\n');

  const user = `User sex: ${profile?.sex ?? 'not specified'}\nGoal: ${profile?.goal ?? 'not specified'}\n\nMarkers:\n${markerList}\n\nProvide plain-English educational observations about these values and any general nutrition or lifestyle considerations.`;

  const response = await callOpenAI(system, user);
  return `${disclaimer}\n\n${response}`;
}

function generateMockBloodworkSummary(markers: BloodworkMarker[]): string {
  const lines: string[] = [];

  for (const m of markers) {
    const flag =
      m.referenceMin != null && m.referenceMax != null
        ? m.value < m.referenceMin
          ? ' — **below reference range**'
          : m.value > m.referenceMax
          ? ' — **above reference range**'
          : ' — within reference range'
        : '';

    lines.push(`**${m.markerName}:** ${m.value} ${m.unit}${flag}`);
  }

  lines.push('');
  lines.push(
    'Some values appear outside common reference ranges. Consider discussing these with your healthcare provider, who can interpret them in the context of your full medical history.',
  );

  return lines.join('\n');
}
