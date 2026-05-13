# Vitra — AI-First Nutrition Tracker

A clean, mobile-first nutrition tracking web app built with Next.js 15, TypeScript, Tailwind CSS, PostgreSQL/Prisma, and NextAuth v5. Log meals, upload meal photos for AI analysis, track macros and micronutrients, and get AI-generated daily nutrition outlooks. Users can also enter bloodwork markers and receive general educational diet/lifestyle insights.

> **Important:** All bloodwork insights are educational only and are not medical advice. Always review lab results with a licensed healthcare professional.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth v5 (`next-auth@beta`) |
| AI | OpenAI API (gpt-4o / gpt-4o-mini) — mock fallback included |
| Payments | Stripe-ready structure (not wired yet) |

---

## Project Structure

```
vitra/
├── prisma/
│   ├── schema.prisma          # All DB models
│   └── seed.ts                # 30 common foods + demo user
├── src/
│   ├── auth.ts                # NextAuth config
│   ├── middleware.ts           # Route protection
│   ├── lib/
│   │   ├── prisma.ts          # Prisma singleton
│   │   ├── nutrition.ts       # BMR/TDEE helpers
│   │   └── ai-service.ts      # AI service functions
│   ├── types/
│   │   └── next-auth.d.ts     # Session type augmentation
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx    # Desktop sidebar + mobile nav
│   │   └── ui/
│   │       ├── ProgressBar.tsx
│   │       ├── MacroRing.tsx
│   │       └── AIInsightCard.tsx
│   └── app/
│       ├── globals.css
│       ├── layout.tsx
│       ├── page.tsx            # Redirects to /dashboard
│       ├── login/page.tsx
│       ├── onboarding/page.tsx
│       ├── (app)/              # Auth-protected layout group
│       │   ├── layout.tsx
│       │   ├── dashboard/
│       │   │   ├── page.tsx
│       │   │   └── generate-insight/page.tsx
│       │   ├── log-food/page.tsx
│       │   ├── meal-photo/page.tsx
│       │   ├── bloodwork/
│       │   │   ├── page.tsx
│       │   │   └── BloodworkClient.tsx
│       │   └── settings/
│       │       ├── page.tsx
│       │       └── SettingsClient.tsx
│       └── api/
│           ├── auth/
│           │   ├── [...nextauth]/route.ts
│           │   └── register/route.ts
│           ├── meals/route.ts
│           ├── meal-photo/
│           │   ├── analyze/route.ts
│           │   └── save/route.ts
│           ├── foods/search/route.ts
│           ├── bloodwork/
│           │   ├── route.ts
│           │   ├── [id]/route.ts
│           │   └── insight/route.ts
│           ├── insights/daily/route.ts
│           └── user/profile/route.ts
```

---

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL database

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/vitra"
AUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Optional — Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Optional — leave blank to use mock AI responses
OPENAI_API_KEY=""
```

### 3. Set up the database

```bash
# Push schema to database
npm run db:push

# Seed 30 common foods + demo user
npm run db:seed
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Demo account:** `demo@vitra.app` / `demo1234`

---

## Database Models

| Model | Purpose |
|---|---|
| `User` | Auth identity |
| `UserProfile` | Age, sex, height, weight, goals, targets |
| `Food` | Nutrition database (seeded + user-created) |
| `Meal` | A meal event with a type and optional photo |
| `MealItem` | Food + serving count within a meal (with nutrient snapshot) |
| `DailyNutritionSummary` | Rolled-up daily totals (updated on each log) |
| `BloodworkMarker` | Lab value entries with reference ranges |
| `AIInsight` | Stored AI-generated insights |
| `SubscriptionStatus` | Free/Pro tier, Stripe-ready fields |

---

## AI Service

Three reusable functions in `src/lib/ai-service.ts`:

### `generateDailyNutritionOutlook(profile, dailyLog, weeklyTrends, bloodwork)`
Generates 3–5 plain-English nutrition insights based on today's food log, weekly trends, goals, and any bloodwork values.

### `analyzeMealPhoto(base64Image, mimeType)`
Sends a meal photo to GPT-4o Vision and returns estimated food items, portions, calories, protein, carbs, fat, and a confidence score.

### `generateBloodworkSummary(profile, markers)`
Generates educational commentary on lab values with general nutrition/lifestyle suggestions. Always includes a medical disclaimer.

**All three functions return mock responses when `OPENAI_API_KEY` is not set**, so the app is fully usable without an API key.

---

## Subscription Tiers

| Feature | Free | Pro |
|---|---|---|
| Manual food logging | ✅ | ✅ |
| Macro/calorie tracking | ✅ | ✅ |
| Bloodwork entry | ✅ | ✅ |
| AI daily outlook | ❌ | ✅ |
| Meal photo analysis | ❌ | ✅ |
| AI bloodwork summary | ❌ | ✅ |

Payment processing is not implemented yet. The `SubscriptionStatus` model includes Stripe fields (`stripeCustomerId`, `stripeSubId`) ready for integration.

---

## Adding More Foods

Add entries to the `foods` array in `prisma/seed.ts` and re-run `npm run db:seed`. Or create custom foods via the API — any food with `isCustom: true` was created by a user.

---

## Safety & Disclaimers

- The AI is explicitly instructed to never diagnose disease, recommend medication, or advise ignoring medical professionals
- All bloodwork insights include a hardcoded disclaimer banner in the UI and in the AI prompt
- Hedging language ("may", "could", "consider discussing with your clinician") is enforced at the prompt level
- The app presents itself as an educational and tracking tool, not a diagnostic one

---

## Extending the App

**Add a real food API:** Replace or augment the food search in `src/app/api/foods/search/route.ts` with calls to USDA FoodData Central or Open Food Facts.

**Enable Stripe payments:** Add Stripe webhook handling in a new API route, update `SubscriptionStatus` via webhook events, and gate Pro features using the `tier` field.

**Add weekly trends page:** Use `DailyNutritionSummary` records to render 7-day charts (recommend Recharts or Chart.js).
