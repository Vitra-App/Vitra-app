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
 mealName?: string;
 items: Array<{
   name: string;
   estimatedServingSize: string;
   quantity: number;
   calories: number;
   minCalories?: number;
   maxCalories?: number;
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
   /** Brief plain-language assumptions this item's estimate depends on (e.g. "assumed 1 tbsp oil for sauté"). */
   assumptions?: string[];
 }>;
 plateEstimate?: {
   type: string;
   diameterInches?: number;
   fillPercent?: number;
   estimatedVolumeMl?: number;
 };
 hiddenCalories?: string[];
 totalCalories: number;
 /** Plausible minimum total calories -- honest uncertainty range, not just a point estimate. */
 minCalories?: number;
 /** Plausible maximum total calories. */
 maxCalories?: number;
 totalProteinG: number;
 totalCarbsG: number;
 totalFatG: number;
 confidenceScore: number; // 0–1
 /** Main drivers of uncertainty in this estimate (e.g. "dressing amount not visible", "partially occluded rice"). */
 uncertaintyDrivers?: string[];
 /** A single targeted question that would materially improve accuracy if answered, or null if not needed. */
 clarifyingQuestion?: string | null;
 notes: string;
 /** Populated server-side (not by the model) -- deterministic sanity-check warnings. */
 validationWarnings?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasOpenAIKey(): boolean {
 return Boolean(process.env.OPENAI_API_KEY?.trim());
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
 const { default: OpenAI } = await import('openai');
 const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 3, defaultHeaders: { 'Accept-Encoding': 'identity' } });

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

 const proteinGap = profile?.proteinTargetG ? profile.proteinTargetG - dailyLog.proteinG : null;
 const calGap = profile?.caloricTarget ? profile.caloricTarget - dailyLog.calories : null;
 const timeOfDay = new Date().getHours() < 14 ? 'morning/midday' : 'evening';

 const system = `You are a blunt, sharp nutrition coach. Write 3 observations grounded in the exact numbers and foods listed below.
Rules (read carefully):
1. Every bullet must cite a specific food name OR a specific number — never both generic
2. If protein is more than 30g below target, that is the MOST important thing to call out
3. If calories are more than 400 below target by ${timeOfDay}, note what's missing
4. Mention the macro split only if it's notably imbalanced (e.g. carbs >60% of calories)
5. Never use: "ensure", "optimize", "prioritize", "crucial", "intake", "overall", "balanced diet", "healthy choices"
6. Never start a sentence with "You" — use the food name, a number, or a fragment instead
7. Sentences must be under 18 words each
8. Format: exactly 3 bullet points. Each starts with one emoji then a space. Nothing else.`;

 const calPctStr = calPct !== null ? ` (${calPct}%)` : '';
 const protPctStr = protPct !== null ? ` (${protPct}%)` : '';
 const bloodworkLine = bloodworkSummary ? `\nBloodwork: ${bloodworkSummary}` : '';

 const user = `Goal: ${profile?.goal ?? 'maintain'}
Calorie target: ${profile?.caloricTarget ?? 2000} kcal | Eaten: ${dailyLog.calories} kcal${calPctStr}
Protein target: ${profile?.proteinTargetG ?? 150}g | Eaten: ${dailyLog.proteinG}g${protPctStr}
Carbs: ${dailyLog.carbsG}g | Fat: ${dailyLog.fatG}g | Fiber: ${dailyLog.fiberG}g

What they actually ate today:
${mealSummary}

Weekly context: avg ${weeklyTrends.avgCalories} kcal/day, ${weeklyTrends.daysLogged} days logged this week${bloodworkLine}`;

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

 const avgCal = Math.round(daysLogged.reduce((s, d) => s + d.calories, 0) / daysLogged.length);
 const avgProt = Math.round(daysLogged.reduce((s, d) => s + d.proteinG, 0) / daysLogged.length);
 const avgCarb = Math.round(daysLogged.reduce((s, d) => s + d.carbsG, 0) / daysLogged.length);
 const avgFat = Math.round(daysLogged.reduce((s, d) => s + d.fatG, 0) / daysLogged.length);
 const calTarget = profile?.caloricTarget ?? 2000;
 const protTarget = profile?.proteinTargetG ?? 150;
 const calDiff = avgCal - calTarget;
 const protDiff = avgProt - protTarget;
 const daysOverCal = daysLogged.filter(d => d.calories > calTarget * 1.1).length;
 const daysUnderProt = daysLogged.filter(d => d.proteinG < protTarget * 0.8).length;
 const highestCal = daysLogged.reduce((a, b) => a.calories > b.calories ? a : b);
 const lowestCal = daysLogged.reduce((a, b) => a.calories < b.calories ? a : b);

 const system = `You are a blunt, data-driven nutrition coach writing a 7-day review.
Rules:
1. Open with the single most important pattern from this week — reference actual numbers
2. Each bullet must include a specific number (calories, grams, days) — no vague statements
3. If protein missed target more than 3 days, that is bullet 1
4. If calories were consistently over/under, say by exactly how much on average
5. Mention the highest-calorie day and lowest-calorie day if the swing is > 400 kcal
6. Last bullet: one specific, actionable change for next week (not "eat more vegetables")
7. Never use: "ensure", "optimize", "balanced", "overall", "prioritize", "crucial"
8. 4-5 bullets max. Emoji + one sentence each. No headers, no bold.`;

 const user = `Goal: ${profile?.goal ?? 'not set'} | Cal target: ${calTarget} | Protein target: ${protTarget}g
Days logged: ${daysLogged.length}/7
Avg: ${avgCal} kcal (${calDiff >= 0 ? '+' : ''}${calDiff} vs target), ${avgProt}g protein (${protDiff >= 0 ? '+' : ''}${protDiff}g vs target), ${avgCarb}g carbs, ${avgFat}g fat
Days over cal target (>10%): ${daysOverCal}
Days under protein (< 80% target): ${daysUnderProt}
Highest day: ${highestCal.date} ${Math.round(highestCal.calories)} kcal
Lowest day: ${lowestCal.date} ${Math.round(lowestCal.calories)} kcal
Daily: ${days.map(d => d.calories > 0 ? `${d.date.slice(5)}: ${Math.round(d.calories)}kcal ${Math.round(d.proteinG)}gP` : `${d.date.slice(5)}: -`).join(' | ')}`;

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

// ── Model selection & escalation ──────────────────────────────────────────────
//
// GPT-5.6 Luna handles the vast majority of meal scans by default. Its own
// built-in reasoning does the portion/calorie/macro estimation -- we no longer
// hand-roll a step-by-step chain-of-thought framework or manual "undercounting
// correction" bias in the prompt; the model is trusted to do that itself.
// Any scan Luna itself flags as low-confidence or ambiguous (via confidenceScore
// or clarifyingQuestion) is automatically re-run once on GPT-5.6 Terra, a more
// capable/expensive model reserved for exactly these harder cases.

const MODEL_STANDARD = 'gpt-5.6-luna';
const MODEL_ESCALATED = 'gpt-5.6-terra';
const ESCALATION_CONFIDENCE_THRESHOLD = 0.75;

function needsEscalation(analysis: MealPhotoAnalysis): boolean {
  return analysis.confidenceScore < ESCALATION_CONFIDENCE_THRESHOLD || Boolean(analysis.clarifyingQuestion);
}

function buildReferenceBlock(
  referenceFoods: Array<{ name: string; brand: string | null; servingSize: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG?: number | null; sugarG?: number | null; sodiumMg?: number | null }> | undefined,
  portionPhrase: string,
): string {
  if (!referenceFoods || referenceFoods.length === 0) return '';
  const lines = referenceFoods.slice(0, 8).map((f) => {
    const label = f.brand ? `${f.brand} ${f.name}` : f.name;
    return `- ${label} (per ${f.servingSize}): ${Math.round(f.calories)} kcal, ${f.proteinG}g protein, ${f.carbsG}g carbs, ${f.fatG}g fat` +
      (f.fiberG != null ? `, ${f.fiberG}g fiber` : '') +
      (f.sugarG != null ? `, ${f.sugarG}g sugar` : '') +
      (f.sodiumMg != null ? `, ${Math.round(f.sodiumMg)}mg sodium` : '');
  });
  return `\n\nMATCHED DATABASE PRODUCTS (the user named a brand/product -- use THESE exact nutrition values, scaled to the ${portionPhrase}, instead of generic estimates):\n${lines.join('\n')}`;
}

const PHOTO_JSON_SCHEMA = `{
 "mealName": "",
 "items": [{ "name": "", "estimatedServingSize": "", "quantity": 1, "calories": 0, "minCalories": 0, "maxCalories": 0, "proteinG": 0, "carbsG": 0, "fatG": 0, "fiberG": 0, "sugarG": 0, "sodiumMg": 0, "cholesterolMg": 0, "saturatedFatG": 0, "potassiumMg": 0, "vitaminDMcg": 0, "calciumMg": 0, "ironMg": 0, "assumptions": [""] }],
 "plateEstimate": { "type": "", "diameterInches": 0, "fillPercent": 0, "estimatedVolumeMl": 0 },
 "hiddenCalories": [""],
 "totalCalories": 0,
 "minCalories": 0,
 "maxCalories": 0,
 "totalProteinG": 0,
 "totalCarbsG": 0,
 "totalFatG": 0,
 "confidenceScore": 0.0,
 "uncertaintyDrivers": [""],
 "clarifyingQuestion": null,
 "notes": ""
}`;

const PHOTO_SYSTEM_PROMPT = `You are a precise nutrition analyst. Analyze the meal photo and estimate calories, macros, serving sizes, and ingredients with the rigor of a registered dietitian. Identify every visibly distinct food item separately (don't merge them into one combined item), account for likely hidden ingredients (cooking oil, butter, sauces, dressings, cheese) even when not clearly visible, and give an honest confidenceScore plus a realistic minCalories/maxCalories uncertainty range rather than false precision.

Return this exact JSON structure:
${PHOTO_JSON_SCHEMA}

IMPORTANT RULES:
- estimatedServingSize must be a weight (e.g. "180g") or volume (e.g. "350ml") -- NOT "1 serving"
- Group identical items: 3 chicken strips = one item with quantity=3, calories/macros for ONE strip
- All macro fields = values for ONE unit of estimatedServingSize
- clarifyingQuestion: set to ONE short, specific question only if a single missing detail would materially change the total (e.g. dressing amount, fried vs grilled); otherwise null. Always return a complete best-estimate answer regardless.
- NEVER invent a specific brand, restaurant, or product name that isn't visually evident or provided in "MATCHED DATABASE PRODUCTS" below. Use plain generic food names for anything home-style or unbranded.
- BRAND MATCHING: If "MATCHED DATABASE PRODUCTS" are provided, use those EXACT per-serving values (scaled to the visible portion) instead of generic estimates, and put the brand in the item name.`;

const TEXT_JSON_SCHEMA = `{
  "mealName": "",
  "items": [{ "name": "", "estimatedServingSize": "", "quantity": 1, "calories": 0, "minCalories": 0, "maxCalories": 0, "proteinG": 0, "carbsG": 0, "fatG": 0, "fiberG": 0, "sugarG": 0, "sodiumMg": 0, "cholesterolMg": 0, "saturatedFatG": 0, "potassiumMg": 0, "vitaminDMcg": 0, "calciumMg": 0, "ironMg": 0, "assumptions": [""] }],
  "hiddenCalories": [""],
  "totalCalories": 0,
  "minCalories": 0,
  "maxCalories": 0,
  "totalProteinG": 0,
  "totalCarbsG": 0,
  "totalFatG": 0,
  "confidenceScore": 0.0,
  "uncertaintyDrivers": [""],
  "clarifyingQuestion": null,
  "notes": ""
}`;

const TEXT_SYSTEM_PROMPT = `You are a precise nutrition analyst. Given a plain-text description of a meal (no photo), estimate calories and macros with the rigor of a registered dietitian using realistic portion sizes. Use the user's stated quantities exactly when given; otherwise assume one standard serving. Account for likely hidden ingredients implied by preparation words (fried, buttered, creamy, etc.) even when not stated explicitly, and give an honest confidenceScore plus a realistic minCalories/maxCalories uncertainty range.

Return this exact JSON structure:
${TEXT_JSON_SCHEMA}

IMPORTANT RULES:
- estimatedServingSize must be a weight, volume, or clear unit count (e.g. "1 medium bagel") -- NOT "1 serving"
- Group identical items: "4 scrambled eggs" = one item with quantity=4, calories/macros for ONE egg
- All macro fields = values for ONE unit of estimatedServingSize
- clarifyingQuestion: set to ONE short question only if a single missing detail would materially change the total; otherwise null. Always return a complete best-estimate answer regardless.
- NEVER invent a specific brand/restaurant/product the user didn't mention (or that isn't in "MATCHED DATABASE PRODUCTS" below). Use plain generic food names otherwise.
- BRAND MATCHING: If "MATCHED DATABASE PRODUCTS" are provided, use those EXACT per-serving values (scaled to the described portion) instead of generic estimates, and put the brand in the item name.`;

async function getOpenAIClient() {
  const { default: OpenAI } = await import('openai');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 3, defaultHeaders: { 'Accept-Encoding': 'identity' } });
}

async function runPhotoAnalysis(model: string, base64Image: string, mimeType: string, userText: string): Promise<MealPhotoAnalysis> {
  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: PHOTO_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' } },
          { type: 'text', text: userText },
        ],
      },
    ],
    max_completion_tokens: 4000,
    response_format: { type: 'json_object' },
  });
  const raw = response.choices[0]?.message?.content ?? '{}';
  if (!raw.trim()) {
    throw new Error(`Empty response from ${model} (finish_reason: ${response.choices[0]?.finish_reason ?? 'unknown'}) -- likely ran out of completion tokens during reasoning.`);
  }
  return JSON.parse(raw) as MealPhotoAnalysis;
}

async function runTextAnalysis(model: string, userText: string): Promise<MealPhotoAnalysis> {
  const client = await getOpenAIClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: TEXT_SYSTEM_PROMPT },
      { role: 'user', content: userText },
    ],
    // Text-only scans are the simplest case (no image to interpret) -- "low" reasoning effort
    // is plenty for accurate macro estimation, and noticeably faster/cheaper than the default.
    // Photo analysis intentionally does NOT set this, since visual interpretation benefits more
    // from the model's default reasoning depth.
    reasoning_effort: 'low',
    max_completion_tokens: 3000,
    response_format: { type: 'json_object' },
  });
  const raw = response.choices[0]?.message?.content ?? '{}';
  if (!raw.trim()) {
    throw new Error(`Empty response from ${model} (finish_reason: ${response.choices[0]?.finish_reason ?? 'unknown'}) -- likely ran out of completion tokens during reasoning.`);
  }
  return JSON.parse(raw) as MealPhotoAnalysis;
}

// ── analyzeMealPhoto ──────────────────────────────────────────────────────────

export async function analyzeMealPhoto(
  base64Image: string,
  mimeType: string = 'image/jpeg',
  description?: string,
  referenceFoods?: Array<{ name: string; brand: string | null; servingSize: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG?: number | null; sugarG?: number | null; sodiumMg?: number | null }>,
): Promise<MealPhotoAnalysis> {
  if (!hasOpenAIKey()) {
    return getMockMealPhotoAnalysis();
  }

  const referenceBlock = buildReferenceBlock(referenceFoods, 'visible portion');
  const userText = (description
    ? `The user says: "${description}". Analyse this meal and return the JSON.`
    : 'Analyse this meal and return the JSON.') + referenceBlock;

  let analysis = await runPhotoAnalysis(MODEL_STANDARD, base64Image, mimeType, userText);
  if (needsEscalation(analysis)) {
    console.log(`🔺 Escalating meal photo analysis from ${MODEL_STANDARD} to ${MODEL_ESCALATED} (confidence=${analysis.confidenceScore})`);
    analysis = await runPhotoAnalysis(MODEL_ESCALATED, base64Image, mimeType, userText);
  }
  return analysis;
}

// -- analyzeMealText (no image -- pure text description) ----------------------

export async function analyzeMealText(
  description: string,
  referenceFoods?: Array<{ name: string; brand: string | null; servingSize: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG?: number | null; sugarG?: number | null; sodiumMg?: number | null }>,
): Promise<MealPhotoAnalysis> {
  if (!hasOpenAIKey()) {
    return getMockMealTextAnalysis(description);
  }

  const referenceBlock = buildReferenceBlock(referenceFoods, 'described portion');
  const userText = `The user describes what they ate: "${description}". Estimate calories and macros for each food item and return the JSON.${referenceBlock}`;

  let analysis = await runTextAnalysis(MODEL_STANDARD, userText);
  if (needsEscalation(analysis)) {
    console.log(`🔺 Escalating meal text analysis from ${MODEL_STANDARD} to ${MODEL_ESCALATED} (confidence=${analysis.confidenceScore})`);
    analysis = await runTextAnalysis(MODEL_ESCALATED, userText);
  }
  return analysis;
}

function getMockMealTextAnalysis(description: string): MealPhotoAnalysis {
  return {
    items: [
      { name: 'Scrambled Eggs', estimatedServingSize: '1 large egg', quantity: 4, calories: 90, minCalories: 80, maxCalories: 100, proteinG: 6.3, carbsG: 0.6, fatG: 6.5, fiberG: 0, sugarG: 0.4, sodiumMg: 88, cholesterolMg: 164, saturatedFatG: 1.6, potassiumMg: 67, vitaminDMcg: 1.0, calciumMg: 25, ironMg: 0.8, assumptions: ['Assumed no added butter/oil'] },
      { name: 'Plain Bagel', estimatedServingSize: '1 medium bagel (90g)', quantity: 1, calories: 245, minCalories: 220, maxCalories: 280, proteinG: 9.4, carbsG: 48, fatG: 1.4, fiberG: 2, sugarG: 5, sodiumMg: 430, cholesterolMg: 0, saturatedFatG: 0.2, potassiumMg: 100, vitaminDMcg: 0, calciumMg: 20, ironMg: 3, assumptions: ['Assumed medium size, plain (no cream cheese/butter)'] },
    ],
    totalCalories: 605,
    minCalories: 545,
    maxCalories: 690,
    totalProteinG: 34.6,
    totalCarbsG: 50.4,
    totalFatG: 27.4,
    confidenceScore: 0.55,
    uncertaintyDrivers: ['Egg cooking fat not specified', 'Bagel size assumed as medium'],
    clarifyingQuestion: null,
    notes: `Mock analysis for: "${description}" -- add an OpenAI API key for real text-based estimation.`,
  };
}

function getMockMealPhotoAnalysis(): MealPhotoAnalysis {
 return {
   items: [
     { name: 'Grilled Chicken Breast', estimatedServingSize: '150g', quantity: 1, calories: 248, minCalories: 220, maxCalories: 285, proteinG: 46, carbsG: 0, fatG: 5.4, fiberG: 0, sugarG: 0, sodiumMg: 74, cholesterolMg: 125, saturatedFatG: 1.5, potassiumMg: 440, vitaminDMcg: 0.1, calciumMg: 15, ironMg: 1.1, assumptions: ['Assumed grilled, minimal added oil'] },
     { name: 'Brown Rice', estimatedServingSize: '1 cup', quantity: 1, calories: 216, minCalories: 190, maxCalories: 245, proteinG: 5, carbsG: 45, fatG: 1.8, fiberG: 3.5, sugarG: 0.7, sodiumMg: 10, cholesterolMg: 0, saturatedFatG: 0.4, potassiumMg: 154, vitaminDMcg: 0, calciumMg: 20, ironMg: 1.0, assumptions: ['Estimated 1 cup cooked from plate coverage'] },
     { name: 'Steamed Broccoli', estimatedServingSize: '1 cup', quantity: 1, calories: 55, minCalories: 45, maxCalories: 70, proteinG: 3.7, carbsG: 11, fatG: 0.6, fiberG: 5.1, sugarG: 2.6, sodiumMg: 64, cholesterolMg: 0, saturatedFatG: 0.1, potassiumMg: 457, vitaminDMcg: 0, calciumMg: 62, ironMg: 1.1, assumptions: ['Assumed no added butter'] },
   ],
   totalCalories: 519,
   minCalories: 455,
   maxCalories: 600,
   totalProteinG: 54.7,
   totalCarbsG: 56,
   totalFatG: 7.8,
   confidenceScore: 0.72,
   uncertaintyDrivers: ['Rice portion depth on plate approximated', 'Any added oil/butter not clearly visible'],
   clarifyingQuestion: null,
   notes: 'Mock analysis — add an OpenAI API key for real photo analysis.',
 };
}

// ── Deterministic server-side validation (not model-provided) ────────────────

/**
 * Cross-checks the model's own numbers rather than trusting them blindly:
 *  1. Do the item totals actually sum to the reported meal total?
 *  2. Is the reported calorie total roughly consistent with protein*4 + carbs*4 + fat*9
 *     (allowing headroom for fiber/sugar-alcohol/rounding/label conventions)?
 * Returns human-readable warnings to surface to the user -- an empty array means
 * both checks passed within tolerance.
 */
export function validateMealAnalysis(analysis: MealPhotoAnalysis): string[] {
  const warnings: string[] = [];
  if (!analysis.items || analysis.items.length === 0) return warnings;

  const summedCalories = analysis.items.reduce((s, i) => s + i.calories * i.quantity, 0);
  if (analysis.totalCalories > 0 && Math.abs(summedCalories - analysis.totalCalories) / analysis.totalCalories > 0.05) {
    warnings.push(
      `Item calories sum to ${Math.round(summedCalories)}, which doesn't match the reported total of ${Math.round(analysis.totalCalories)}.`,
    );
  }

  const macroCalories = analysis.totalProteinG * 4 + analysis.totalCarbsG * 4 + analysis.totalFatG * 9;
  if (analysis.totalCalories > 0 && Math.abs(macroCalories - analysis.totalCalories) / analysis.totalCalories > 0.2) {
    warnings.push(
      `Macro-derived calories (${Math.round(macroCalories)}) differ notably from the reported total (${Math.round(analysis.totalCalories)}) -- treat this estimate with extra caution.`,
    );
  }

  return warnings;
}

// ── generateBloodworkSummary ──────────────────────────────────────────────────

export async function generateBloodworkSummary(
 profile: Pick<UserProfile, 'sex' | 'goal' | 'healthConditions'> | null,
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
The user may share pre-existing health conditions or medications for context -- use this ONLY to make your educational
observations more relevant (e.g. noting a marker is commonly monitored for a condition they mentioned), and NEVER use it
to diagnose, confirm, rule out, or suggest treatment for any condition.
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

 const conditionsLine = profile?.healthConditions?.trim()
   ? `Pre-existing conditions / medications (user-reported): ${profile.healthConditions.trim()}`
   : 'Pre-existing conditions / medications: none reported';

 const user = `User sex: ${profile?.sex ?? 'not specified'}\nGoal: ${profile?.goal ?? 'not specified'}\n${conditionsLine}\n\nMarkers:\n${markerList}\n\nProvide plain-English educational observations about these values and any general nutrition or lifestyle considerations.`;

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
