// Simulated calorie estimator. The scanner calls ONLY estimate(image).
// A real AI can replace this file without touching the UI.
// item tuple: [name, grams, kcal, protein, carbs, fat]
const MEALS = [
  ['Oatmeal with berries', [['Oatmeal, cooked', 250, 170, 6, 30, 3], ['Mixed berries', 80, 40, 0.5, 9, 0.3], ['Honey', 10, 30, 0, 8, 0], ['Almond slices', 10, 58, 2, 2, 5]]],
  ['Chicken salad', [['Grilled chicken breast', 120, 198, 37, 0, 4], ['Mixed greens', 100, 20, 2, 3, 0], ['Olive oil dressing', 15, 119, 0, 0, 13], ['Cherry tomatoes', 60, 11, 0.5, 2.4, 0.1]]],
  ['Pizza slice', [['Margherita pizza slice', 110, 285, 12, 36, 10], ['Side salad', 80, 16, 1, 3, 0]]],
  ['Sushi set', [['Salmon nigiri', 150, 240, 16, 34, 4], ['Maki roll', 150, 220, 6, 40, 3], ['Miso soup', 200, 40, 3, 4, 1]]],
  ['Burger with fries', [['Cheeseburger', 200, 520, 28, 40, 27], ['French fries', 120, 365, 4, 48, 17]]],
  ['Avocado toast with egg', [['Sourdough toast', 70, 180, 6, 32, 2], ['Avocado', 70, 112, 1, 6, 10], ['Fried egg', 50, 90, 6, 0.5, 7]]],
  ['Pasta bolognese', [['Spaghetti', 220, 345, 12, 70, 2], ['Bolognese sauce', 150, 180, 10, 8, 12], ['Parmesan', 10, 40, 4, 0, 3]]],
  ['Greek yogurt bowl', [['Greek yogurt', 200, 118, 20, 8, 1], ['Granola', 40, 180, 4, 26, 7], ['Banana', 80, 71, 1, 18, 0.2]]],
  ['Beef stir-fry with rice', [['Steamed rice', 180, 235, 5, 51, 0.5], ['Beef strips', 100, 220, 22, 3, 13], ['Stir-fried vegetables', 120, 60, 3, 11, 1]]],
  ['Chicken Caesar wrap', [['Chicken Caesar wrap', 220, 480, 28, 38, 23], ['Apple', 120, 62, 0, 16, 0.2]]],
];
const CONFIDENCE = ['low', 'medium', 'medium', 'high', 'high'];
const r1 = (v) => Math.round(v * 10) / 10;

/** @param {Blob} image @returns {Promise<{dish:string, items:object[], totalKcal:number, confidence:'low'|'medium'|'high'}>} */
export async function estimate(image) {
  if (!image) throw new Error('image-unreadable');
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
  const [dish, tuples] = MEALS[Math.floor(Math.random() * MEALS.length)];
  const items = tuples.map(([name, g, kcal, protein, carbs, fat]) => {
    const grams = Math.max(1, Math.round(g * (1 + (Math.random() * 0.3 - 0.15))));
    const k = grams / g;
    return { name, grams, kcal: Math.round(kcal * k), protein: r1(protein * k), carbs: r1(carbs * k), fat: r1(fat * k) };
  });
  return {
    dish, items,
    totalKcal: items.reduce((a, i) => a + i.kcal, 0),
    confidence: CONFIDENCE[Math.floor(Math.random() * CONFIDENCE.length)],
  };
}
