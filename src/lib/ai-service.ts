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
 plateEstimate?: {
   type: string;
   diameterInches?: number;
   fillPercent?: number;
   estimatedVolumeMl?: number;
 };
 hiddenCalories?: string[];
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

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 3, defaultHeaders: { 'Accept-Encoding': 'identity' } });

  // Build a reference-products block so the AI uses REAL database values for
  // any brand/product the user named (e.g. "Bell & Evans chicken").
  let referenceBlock = '';
  if (referenceFoods && referenceFoods.length > 0) {
    const lines = referenceFoods.slice(0, 8).map((f) => {
      const label = f.brand ? `${f.brand} ${f.name}` : f.name;
      return `- ${label} (per ${f.servingSize}): ${Math.round(f.calories)} kcal, ${f.proteinG}g protein, ${f.carbsG}g carbs, ${f.fatG}g fat` +
        (f.fiberG != null ? `, ${f.fiberG}g fiber` : '') +
        (f.sugarG != null ? `, ${f.sugarG}g sugar` : '') +
        (f.sodiumMg != null ? `, ${Math.round(f.sodiumMg)}mg sodium` : '');
    });
    referenceBlock = `\n\nMATCHED DATABASE PRODUCTS (the user named a brand/product — use THESE exact nutrition values, scaled to the visible portion, instead of generic estimates):\n${lines.join('\n')}`;
  }

  const userText = (description
    ? `The user says: "${description}". Analyse this meal and return the JSON.`
    : 'Analyse this meal and return the JSON.') + referenceBlock;

 const response = await client.chat.completions.create({
   model: 'gpt-4o',
   messages: [
     {
       role: 'system',
       content: `Your primary objective is ACCURACY, not optimism. You are a precise nutrition analyst estimating calories, macros, serving size, and ingredients from a meal photo with the rigor of a registered dietitian.

GENERAL PRINCIPLES
- Never intentionally underestimate calories.
- If uncertain, prefer a realistic higher estimate rather than an unrealistically low one.
- Estimate portions BEFORE estimating nutrition.
- Reason through the steps below internally before producing the final answer.
- If confidence is low, say so in the notes.
- Never invent ingredients that cannot reasonably be inferred from the image or description.

STEP 1 — IMAGE QUALITY
Silently assess: Is the entire meal visible? Is any food hidden/occluded? Is lighting poor? Is the plate cropped? Is there motion blur? If quality is poor, lower confidenceScore accordingly and say why in notes.

STEP 2 — IDENTIFY FOOD
Identify every visibly distinct item SEPARATELY. Do not merge foods together (e.g. list "grilled chicken", "mashed potatoes", "butter", "gravy", "broccoli" as separate items rather than one combined "chicken dinner" item).

STEP 3 — ESTIMATE CONTAINER SIZE
Determine the plate diameter (6/8/9/10/11/12 inch, or charger plate) OR bowl size (small cereal, medium soup, large pasta, deep serving bowl). Estimate approximate volume, fill percentage, and depth. This is your anchor for all portion math. Also look for other reference objects (fork ~19cm, hand, can 355ml, phone) to calibrate.

STEP 4 — ESTIMATE PORTIONS
For EVERY food item, estimate weight in grams (and volume/cups/tbsp where natural, e.g. rice in cups, oil in tbsp). Derive this from the container-size anchor in Step 3 — do NOT default to "1 cup" or "1 serving" without reasoning about the actual visible quantity.

STEP 5 — LOOK FOR HIDDEN CALORIES
Explicitly consider whether each of these is likely present even if not clearly visible: cooking oil, butter, cream, sauces, cheese, added sugar, dressings, nuts, seeds, heavy cream, breading, batter. A glossy/shiny surface = oil or butter was used. Restaurant/fried/creamy food uses MORE fat, oil, sugar and salt than a home-cooked guess would suggest — bias toward the higher end of the plausible range. If hidden calories are probable but not clearly visible, list them in "hiddenCalories" rather than ignoring them.

STEP 6 — CALORIE ESTIMATION
Estimate calories, protein, carbs, fat, fiber, sugar, and sodium for each item using realistic USDA-standard values for the exact weight estimated in Step 4. Then sum everything into the totals.

STEP 7 — SANITY CHECK (perform before finalizing)
Ask yourself: Does this amount of food physically fit on the estimated plate/bowl? Would this satisfy an average adult? Is the total suspiciously low for the visible portion size? Would a restaurant portion typically be larger? Dense foods (pasta, rice, mashed potatoes, granola, peanut butter, nuts, cheese, fries, desserts) compress visually and are almost always MORE than they appear — never underestimate these. Foods photographed close to the camera often appear smaller than they actually are. Do not assume lean cooking methods — if grilling/frying/sautéing/roasting is likely, include realistic cooking fats. If multiple portion sizes are plausible, choose the most probable, not the smallest. If the total still seems low relative to the portion, revise upward before answering.

STEP 8 — CONFIDENCE
confidenceScore: 0.95–1.0 very confident (container + all items clearly visible), 0.80–0.94 good estimate (container visible, minor occlusion), 0.60–0.79 moderate uncertainty (partial visibility or no reference objects), below 0.60 recommend the user retake the photo (state this in notes).

Return this exact JSON structure:
{
 "mealName": "",
 "items": [{ "name": "", "estimatedServingSize": "", "quantity": 1, "calories": 0, "proteinG": 0, "carbsG": 0, "fatG": 0, "fiberG": 0, "sugarG": 0, "sodiumMg": 0, "cholesterolMg": 0, "saturatedFatG": 0, "potassiumMg": 0, "vitaminDMcg": 0, "calciumMg": 0, "ironMg": 0 }],
 "plateEstimate": { "type": "", "diameterInches": 0, "fillPercent": 0, "estimatedVolumeMl": 0 },
 "hiddenCalories": [""],
 "totalCalories": 0,
 "totalProteinG": 0,
 "totalCarbsG": 0,
 "totalFatG": 0,
 "confidenceScore": 0.0,
 "notes": ""
}

IMPORTANT RULES:
- estimatedServingSize must be a weight (e.g. "180g") or volume (e.g. "350ml") — NOT "1 serving"
- Group identical items: 3 chicken strips = one item with quantity=3, calories/macros for ONE strip
- All macro fields = values for ONE unit of estimatedServingSize
- notes field: summarize your container/portion/hidden-calorie reasoning and state confidence explicitly (e.g. "Standard 10in plate, ~70% full. Chicken ~190g (visible density + shrinkage), rice ~2.2 cups compressed, added ~1.5 tbsp oil for sauté. Confidence: good estimate.")
- hiddenCalories: list plain-language items like "Possible hidden calories: cooking oil in stir-fry", "Possible butter on toast" — empty array if genuinely none likely
- BRAND MATCHING: If "MATCHED DATABASE PRODUCTS" are provided below, the user named a specific brand/product. Use those EXACT per-serving nutrition values (scaled to the visible portion) rather than generic estimates, and put the brand in the item name (e.g. "Bell & Evans Chicken Breast"). Raise confidenceScore to 0.9 for those items.

CRITICAL — AVOID SYSTEMATIC UNDERCOUNTING (vision models consistently underestimate calories; correct for this):
- Do not round estimates down "to be safe" — dietitians calibrate to realistic values, which are usually higher than a first visual instinct suggests, especially for meats (cooked shrinkage means visible portions are denser than they look), cheese, nuts, oils, and dressed salads.
- Combination dishes (stir-fries, casseroles, pasta bakes, burritos) almost always contain more oil/fat/cheese mixed throughout than what's visible on the surface — estimate the full dish weight generously, not just the visible top layer.
- When genuinely uncertain between two portion-size estimates, choose the larger one.`,
      },
      {
        role: 'user',
       content: [
         {
           type: 'image_url',
           image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
         },
         { type: 'text', text: userText },
       ],
     },
   ],
   max_tokens: 1600,
   response_format: { type: 'json_object' },
 });

 const raw = response.choices[0]?.message?.content ?? '{}';
 return JSON.parse(raw) as MealPhotoAnalysis;
}

// -- analyzeMealText (no image -- pure text description) ----------------------

export async function analyzeMealText(
  description: string,
  referenceFoods?: Array<{ name: string; brand: string | null; servingSize: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG?: number | null; sugarG?: number | null; sodiumMg?: number | null }>,
): Promise<MealPhotoAnalysis> {
  if (!hasOpenAIKey()) {
    return getMockMealTextAnalysis(description);
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 3, defaultHeaders: { 'Accept-Encoding': 'identity' } });

  let referenceBlock = '';
  if (referenceFoods && referenceFoods.length > 0) {
    const lines = referenceFoods.slice(0, 8).map((f) => {
      const label = f.brand ? `${f.brand} ${f.name}` : f.name;
      return `- ${label} (per ${f.servingSize}): ${Math.round(f.calories)} kcal, ${f.proteinG}g protein, ${f.carbsG}g carbs, ${f.fatG}g fat` +
        (f.fiberG != null ? `, ${f.fiberG}g fiber` : '') +
        (f.sugarG != null ? `, ${f.sugarG}g sugar` : '') +
        (f.sodiumMg != null ? `, ${Math.round(f.sodiumMg)}mg sodium` : '');
    });
    referenceBlock = `\n\nMATCHED DATABASE PRODUCTS (the user named a brand/product -- use THESE exact nutrition values, scaled to the described portion, instead of generic estimates):\n${lines.join('\n')}`;
  }

  const userText = `The user describes what they ate: "${description}". Estimate calories and macros for each food item and return the JSON.${referenceBlock}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Your primary objective is ACCURACY, not optimism. You are a precise nutrition analyst. Given a plain-text description of a meal (no photo), estimate calories and macros with the rigor of a registered dietitian, using realistic USDA-style portion sizes.

PORTION ESTIMATION RULES:
1. If the user gives a quantity (e.g. "4 scrambled eggs", "2 slices of bacon"), use that exact count.
2. If no quantity is given for an item, assume ONE standard/typical serving (e.g. "a bagel" = 1 medium bagel ~90g, "rice" = 1 cup cooked) — but lean toward the larger end of "typical" (e.g. a restaurant/takeout item mentioned by name is usually bigger than a home-cooked default).
3. Use realistic USDA nutrition database values for each food at that quantity/serving size.
4. Do NOT ask clarifying questions — always produce your best estimate.

HIDDEN CALORIES: Explicitly consider preparation words. "Fried" implies ~1-2 tbsp absorbed oil (100-250 kcal). "Buttered"/"sautéed" implies added fat. "Creamy"/"cheesy" implies more fat/calories than a plain version. Restaurant/takeout dishes and sauces/dressings/gravies typically contain more fat, sugar, and salt than a minimal home-cooked estimate. List anything probable but not explicitly stated in "hiddenCalories".

SANITY CHECK before finalizing: Would this realistically satisfy an average adult for this meal? Is the total suspiciously low for what was described? Dense foods (pasta, rice, granola, nuts, cheese, fries, desserts, peanut butter) should never be underestimated. When uncertain between two plausible estimates, choose the larger one — underestimating is the more common and more harmful error.

Return this exact JSON structure:
{
  "mealName": "",
  "items": [{ "name": "", "estimatedServingSize": "", "quantity": 1, "calories": 0, "proteinG": 0, "carbsG": 0, "fatG": 0, "fiberG": 0, "sugarG": 0, "sodiumMg": 0, "cholesterolMg": 0, "saturatedFatG": 0, "potassiumMg": 0, "vitaminDMcg": 0, "calciumMg": 0, "ironMg": 0 }],
  "hiddenCalories": [""],
  "totalCalories": 0,
  "totalProteinG": 0,
  "totalCarbsG": 0,
  "totalFatG": 0,
  "confidenceScore": 0.0,
  "notes": ""
}

IMPORTANT RULES:
- estimatedServingSize must be a weight (e.g. "50g") or volume (e.g. "240ml"), or a clear unit count (e.g. "1 medium bagel") -- NOT "1 serving"
- Group identical items: "4 scrambled eggs" = one item with quantity=4, calories/macros for ONE egg
- All macro fields = values for ONE unit of estimatedServingSize
- notes field: briefly state any assumptions made about unspecified quantities and hidden-calorie reasoning (e.g. "Assumed 1 medium plain bagel (~90g) and 2 large fried eggs; added ~1 tbsp oil for frying")
- confidenceScore: 0.80-0.95 if quantities were explicit, 0.55-0.79 if serving sizes were assumed, below 0.55 if the description was vague
- hiddenCalories: empty array if genuinely none likely
- BRAND MATCHING: If "MATCHED DATABASE PRODUCTS" are provided below, the user named a specific brand/product. Use those EXACT per-serving nutrition values (scaled to the described portion) rather than generic estimates, and put the brand in the item name. Raise confidenceScore to 0.85 for those items.`,
      },
      { role: 'user', content: userText },
    ],
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as MealPhotoAnalysis;
}

function getMockMealTextAnalysis(description: string): MealPhotoAnalysis {
  return {
    items: [
      { name: 'Scrambled Eggs', estimatedServingSize: '1 large egg', quantity: 4, calories: 90, proteinG: 6.3, carbsG: 0.6, fatG: 6.5, fiberG: 0, sugarG: 0.4, sodiumMg: 88, cholesterolMg: 164, saturatedFatG: 1.6, potassiumMg: 67, vitaminDMcg: 1.0, calciumMg: 25, ironMg: 0.8 },
      { name: 'Plain Bagel', estimatedServingSize: '1 medium bagel (90g)', quantity: 1, calories: 245, proteinG: 9.4, carbsG: 48, fatG: 1.4, fiberG: 2, sugarG: 5, sodiumMg: 430, cholesterolMg: 0, saturatedFatG: 0.2, potassiumMg: 100, vitaminDMcg: 0, calciumMg: 20, ironMg: 3 },
    ],
    totalCalories: 605,
    totalProteinG: 34.6,
    totalCarbsG: 50.4,
    totalFatG: 27.4,
    confidenceScore: 0.55,
    notes: `Mock analysis for: "${description}" -- add an OpenAI API key for real text-based estimation.`,
  };
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
