import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const COMMON_FOODS = [
  { name: 'Ribeye Steak', servingSize: '225g (8oz)', servingWeightG: 225, calories: 540, proteinG: 48, carbsG: 0, fatG: 38, sodiumMg: 110 },
  { name: 'New York Strip Steak', servingSize: '225g (8oz)', servingWeightG: 225, calories: 450, proteinG: 52, carbsG: 0, fatG: 26, sodiumMg: 115 },
  { name: 'Sirloin Steak', servingSize: '200g (7oz)', servingWeightG: 200, calories: 360, proteinG: 50, carbsG: 0, fatG: 16, sodiumMg: 100 },
  { name: 'T-Bone Steak', servingSize: '280g (10oz)', servingWeightG: 280, calories: 600, proteinG: 60, carbsG: 0, fatG: 40, sodiumMg: 130 },
  { name: 'Filet Mignon', servingSize: '170g (6oz)', servingWeightG: 170, calories: 340, proteinG: 42, carbsG: 0, fatG: 18, sodiumMg: 85 },
  { name: 'Ground Beef 80/20', servingSize: '100g', servingWeightG: 100, calories: 254, proteinG: 17, carbsG: 0, fatG: 20, sodiumMg: 75 },
  { name: 'Ground Beef 90/10', servingSize: '100g', servingWeightG: 100, calories: 196, proteinG: 20, carbsG: 0, fatG: 13, sodiumMg: 72 },
  { name: 'Beef Burger Patty', servingSize: '113g (4oz)', servingWeightG: 113, calories: 287, proteinG: 19, carbsG: 0, fatG: 23, sodiumMg: 80 },
  { name: 'Beef Mince', servingSize: '100g', servingWeightG: 100, calories: 254, proteinG: 17, carbsG: 0, fatG: 20, sodiumMg: 75 },
  { name: 'Chicken Breast', servingSize: '150g', servingWeightG: 150, calories: 248, proteinG: 46, carbsG: 0, fatG: 5, sodiumMg: 100 },
  { name: 'Chicken Breast Grilled', servingSize: '150g', servingWeightG: 150, calories: 232, proteinG: 43, carbsG: 0, fatG: 5, sodiumMg: 110 },
  { name: 'Chicken Thigh', servingSize: '100g', servingWeightG: 100, calories: 209, proteinG: 26, carbsG: 0, fatG: 11, sodiumMg: 88 },
  { name: 'Chicken Wings', servingSize: '100g', servingWeightG: 100, calories: 203, proteinG: 30, carbsG: 0, fatG: 9, sodiumMg: 96 },
  { name: 'Rotisserie Chicken', servingSize: '140g', servingWeightG: 140, calories: 280, proteinG: 34, carbsG: 0, fatG: 16, sodiumMg: 450 },
  { name: 'Egg', servingSize: '1 large egg (50g)', servingWeightG: 50, calories: 72, proteinG: 6, carbsG: 0.4, fatG: 5, sodiumMg: 71 },
  { name: 'Scrambled Eggs', servingSize: '2 eggs (100g)', servingWeightG: 100, calories: 149, proteinG: 10, carbsG: 1.6, fatG: 11, sodiumMg: 232 },
  { name: 'Egg White', servingSize: '33g', servingWeightG: 33, calories: 17, proteinG: 4, carbsG: 0.2, fatG: 0, sodiumMg: 55 },
  { name: 'Greek Yogurt Plain', servingSize: '170g', servingWeightG: 170, calories: 100, proteinG: 17, carbsG: 6, fatG: 0, sodiumMg: 65 },
  { name: 'Whole Milk', servingSize: '240ml (1 cup)', servingWeightG: 244, calories: 149, proteinG: 8, carbsG: 12, fatG: 8, sodiumMg: 105 },
  { name: 'Cheddar Cheese', servingSize: '28g (1oz)', servingWeightG: 28, calories: 113, proteinG: 7, carbsG: 0.4, fatG: 9, sodiumMg: 185 },
  { name: 'Salmon Fillet', servingSize: '170g (6oz)', servingWeightG: 170, calories: 354, proteinG: 38, carbsG: 0, fatG: 22, sodiumMg: 86 },
  { name: 'Tuna Canned in Water', servingSize: '85g (3oz)', servingWeightG: 85, calories: 100, proteinG: 22, carbsG: 0, fatG: 1, sodiumMg: 320 },
  { name: 'Cod Fillet', servingSize: '170g', servingWeightG: 170, calories: 180, proteinG: 39, carbsG: 0, fatG: 1.5, sodiumMg: 140 },
  { name: 'Shrimp Cooked', servingSize: '85g (3oz)', servingWeightG: 85, calories: 84, proteinG: 18, carbsG: 0, fatG: 1, sodiumMg: 190 },
  { name: 'Pork Chop', servingSize: '170g (6oz)', servingWeightG: 170, calories: 340, proteinG: 40, carbsG: 0, fatG: 19, sodiumMg: 120 },
  { name: 'Bacon Cooked', servingSize: '3 slices (34g)', servingWeightG: 34, calories: 161, proteinG: 12, carbsG: 0.5, fatG: 12, sodiumMg: 580 },
  { name: 'Pork Sausage', servingSize: '57g (2 links)', servingWeightG: 57, calories: 198, proteinG: 8, carbsG: 1, fatG: 18, sodiumMg: 360 },
  { name: 'White Rice Cooked', servingSize: '186g (1 cup)', servingWeightG: 186, calories: 242, proteinG: 4, carbsG: 53, fatG: 0.4, sodiumMg: 0 },
  { name: 'Brown Rice Cooked', servingSize: '195g (1 cup)', servingWeightG: 195, calories: 216, proteinG: 5, carbsG: 45, fatG: 1.8, sodiumMg: 10 },
  { name: 'Pasta Cooked', servingSize: '140g (1 cup)', servingWeightG: 140, calories: 220, proteinG: 8, carbsG: 43, fatG: 1.3, sodiumMg: 1 },
  { name: 'Oats Rolled', servingSize: '40g (half cup dry)', servingWeightG: 40, calories: 150, proteinG: 5, carbsG: 27, fatG: 3, sodiumMg: 0 },
  { name: 'White Bread Slice', servingSize: '1 slice (28g)', servingWeightG: 28, calories: 79, proteinG: 2.7, carbsG: 15, fatG: 1, sodiumMg: 152 },
  { name: 'Wholemeal Bread Slice', servingSize: '1 slice (28g)', servingWeightG: 28, calories: 69, proteinG: 3.6, carbsG: 12, fatG: 1, sodiumMg: 132 },
  { name: 'Sweet Potato', servingSize: '130g (medium)', servingWeightG: 130, calories: 112, proteinG: 2, carbsG: 26, fatG: 0.1, sodiumMg: 72 },
  { name: 'White Potato Baked', servingSize: '213g (medium)', servingWeightG: 213, calories: 161, proteinG: 4.3, carbsG: 37, fatG: 0.2, sodiumMg: 17 },
  { name: 'Broccoli', servingSize: '91g (1 cup)', servingWeightG: 91, calories: 31, proteinG: 2.6, carbsG: 6, fatG: 0.3, sodiumMg: 30 },
  { name: 'Spinach Raw', servingSize: '30g (1 cup)', servingWeightG: 30, calories: 7, proteinG: 0.9, carbsG: 1.1, fatG: 0.1, sodiumMg: 24 },
  { name: 'Avocado', servingSize: '150g (1 medium)', servingWeightG: 150, calories: 240, proteinG: 3, carbsG: 13, fatG: 22, sodiumMg: 11 },
  { name: 'Banana', servingSize: '118g (1 medium)', servingWeightG: 118, calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, sodiumMg: 1 },
  { name: 'Apple', servingSize: '182g (1 medium)', servingWeightG: 182, calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, sodiumMg: 2 },
  { name: 'Almonds', servingSize: '28g (1oz)', servingWeightG: 28, calories: 164, proteinG: 6, carbsG: 6, fatG: 14, sodiumMg: 1 },
  { name: 'Peanut Butter', servingSize: '32g (2 tbsp)', servingWeightG: 32, calories: 191, proteinG: 7, carbsG: 7, fatG: 16, sodiumMg: 152 },
  { name: 'Olive Oil', servingSize: '14g (1 tbsp)', servingWeightG: 14, calories: 119, proteinG: 0, carbsG: 0, fatG: 14, sodiumMg: 0 },
  { name: 'Whey Protein Powder', servingSize: '30g (1 scoop)', servingWeightG: 30, calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, sodiumMg: 130 },
  { name: 'Cheeseburger', servingSize: '200g', servingWeightG: 200, calories: 490, proteinG: 30, carbsG: 40, fatG: 22, sodiumMg: 900 },
  { name: 'Pizza Cheese Slice', servingSize: '1 slice (107g)', servingWeightG: 107, calories: 272, proteinG: 12, carbsG: 34, fatG: 10, sodiumMg: 551 },
  { name: 'Caesar Salad', servingSize: '200g', servingWeightG: 200, calories: 180, proteinG: 8, carbsG: 10, fatG: 14, sodiumMg: 380 },
  { name: 'Fried Rice', servingSize: '195g (1 cup)', servingWeightG: 195, calories: 238, proteinG: 5, carbsG: 41, fatG: 7, sodiumMg: 576 },
];

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== 'vitra-seed-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deleted = await prisma.food.deleteMany({
    where: { calories: 0, source: { not: 'custom' } },
  });

  let created = 0, updated = 0;
  for (const food of COMMON_FOODS) {
    const existing = await prisma.food.findFirst({ where: { name: food.name, brand: null } });
    if (existing) {
      await prisma.food.update({
        where: { id: existing.id },
        data: { calories: food.calories, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG, servingSize: food.servingSize, servingWeightG: food.servingWeightG, sodiumMg: food.sodiumMg },
      });
      updated++;
    } else {
      await prisma.food.create({
        data: { name: food.name, brand: null, servingSize: food.servingSize, servingWeightG: food.servingWeightG, calories: food.calories, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG, sodiumMg: food.sodiumMg ?? null, source: 'curated' },
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, deletedZeroCalFoods: deleted.count, created, updated });
}
