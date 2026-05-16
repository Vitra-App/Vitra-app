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
): Promise<string> {
  if (!hasOpenAIKey()) {
    return generateMockDailyOutlook(profile, dailyLog, weeklyTrends);
  }

  const system = `You are a sharp, friendly nutrition coach giving a quick daily check-in. 
Be direct, specific, and motivating — no fluff. 
Never diagnose or recommend medication.
Respond with exactly 3-4 bullet points using this format (emoji + one punchy sentence each):
🔥 ...
💪 ...
⚡ ...
(optional 4th bullet)
No headers, no bold text, no numbered lists, no extra commentary.`;

  const bloodworkSummary =
    bloodwork.length > 0
      ? bloodwork
          .map((b) => `${b.markerName}: ${b.value} ${b.unit} (ref: ${b.referenceMin ?? '?'}–${b.referenceMax ?? '?'})`)
          .join(', ')
      : 'None provided';

  const user = `
User goal: ${profile?.goal ?? 'not set'}
Caloric target: ${profile?.caloricTarget ?? 'not set'} kcal
Protein target: ${profile?.proteinTargetG ?? 'not set'} g

Today's intake:
- Calories: ${dailyLog.calories} kcal
- Protein: ${dailyLog.proteinG} g
- Carbs: ${dailyLog.carbsG} g
- Fat: ${dailyLog.fatG} g
- Fiber: ${dailyLog.fiberG} g
- Vitamin D: ${dailyLog.vitaminDMcg} mcg
- Iron: ${dailyLog.ironMg} mg
- Calcium: ${dailyLog.calciumMg} mg

Weekly trends:
- Avg calories: ${weeklyTrends.avgCalories}
- Days under protein target (last 7): ${weeklyTrends.daysUnderProteinTarget}
- Days logged: ${weeklyTrends.daysLogged}

Bloodwork markers: ${bloodworkSummary}

Generate 3–5 plain-English nutrition insights for today.`;

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
