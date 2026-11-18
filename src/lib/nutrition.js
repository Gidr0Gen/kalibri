// Recommended daily calories: Mifflin–St Jeor × activity, adjusted by aim.
const ACTIVITY = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725, very_high: 1.9 };
const AIM = { lose: -500, maintain: 0, gain: 300 };
export const ACTIVITY_LABELS = {
  low: 'Low (desk job)', light: 'Light (1–3 workouts/wk)', moderate: 'Moderate (3–5/wk)',
  high: 'High (6–7/wk)', very_high: 'Very high (physical job)',
};

export function ageFrom(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate + 'T00:00:00');
  if (isNaN(b)) return null;
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 ? a : null;
}

/** @returns {{kcal:number,bmr:number,tdee:number,adj:number}|{missing:string[]}} */
export function recommend(profile, weightKg) {
  const age = ageFrom(profile.birthDate);
  const missing = [];
  if (!profile.sex) missing.push('Sex');
  if (age == null) missing.push('Birth date');
  if (!profile.heightCm) missing.push('Height');
  if (!weightKg) missing.push('Current weight');
  if (missing.length) return { missing };
  const bmr = 10 * weightKg + 6.25 * profile.heightCm - 5 * age + (profile.sex === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY[profile.activity];
  const kcal = Math.max(1200, Math.round(tdee + AIM[profile.aim]));
  return { kcal, bmr: Math.round(bmr), tdee: Math.round(tdee), adj: AIM[profile.aim] };
}
