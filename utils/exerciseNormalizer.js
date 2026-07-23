/**
 * Official Exercise Catalog (31 Exercises)
 * Every workout recommendation in Fitness Buddy MUST strictly use exercises from this catalog.
 */

const OFFICIAL_EXERCISES = [
  "Barbell Back Squat",
  "Barbell Deadlift",
  "Barbell Row",
  "Bench Press",
  "Bodyweight Bulgarian Split Squats",
  "Cable Bicep Curls",
  "Dips (Chest-focused)",
  "Dumbbell Goblet Squats",
  "Dumbbell Incline Bench Press",
  "Dumbbell Shoulder Press",
  "Dumbbell Shrugs",
  "Face Pulls",
  "Hanging Knee Raises",
  "Hyperextensions (Back Extensions)",
  "Incline Barbell Bench Press",
  "Lat Pulldown (Gym)",
  "Leg Press",
  "Low Stress Walking - LISS Cardio",
  "Lying Leg Curls",
  "Machine Chest Press",
  "Overhead Press",
  "Plank",
  "Pull-ups",
  "Romanian Deadlift",
  "Rotator Cuff Warmups (External & Internal Rotations)",
  "Seated Cable Row",
  "Standard Pushups (on knees if needed)",
  "Tricep Extensions",
  "Banded Lat Pulldowns or Banded Rows",
  "Banded Pec Deck (Chest Flies)",
  "Bicep Curls"
];

/**
 * Normalizes any input exercise name to an exact official exercise from our library.
 */
function normalizeToOfficialExercise(name) {
  if (!name || typeof name !== 'string') return "Bench Press";
  const str = name.trim();

  // 1. Direct exact match
  if (OFFICIAL_EXERCISES.includes(str)) return str;

  const rawClean = str.toLowerCase();

  // 2. Exact case-insensitive match
  const exactMatch = OFFICIAL_EXERCISES.find(ex => ex.toLowerCase() === rawClean);
  if (exactMatch) return exactMatch;

  // 3. Rule-based pattern matching to official library
  if (rawClean.includes('rotator')) return "Rotator Cuff Warmups (External & Internal Rotations)";
  if (rawClean.includes('incline') && (rawClean.includes('bench') || rawClean.includes('press') || rawClean.includes('fly'))) {
    return rawClean.includes('barbell') ? "Incline Barbell Bench Press" : "Dumbbell Incline Bench Press";
  }
  if (rawClean.includes('overhead') || rawClean.includes('shoulder press')) return "Overhead Press";
  if (rawClean.includes('bench press') || rawClean.includes('chest press') || rawClean.includes('floor press')) return "Bench Press";
  if (rawClean.includes('pec deck') || rawClean.includes('chest fly') || rawClean.includes('flyes')) return "Banded Pec Deck (Chest Flies)";
  if (rawClean.includes('pushup') || rawClean.includes('push-up') || rawClean.includes('push up')) return "Standard Pushups (on knees if needed)";
  if (rawClean.includes('dip')) return "Dips (Chest-focused)";
  if (rawClean.includes('goblet')) return "Dumbbell Goblet Squats";
  if (rawClean.includes('split squat') || rawClean.includes('bulgarian') || rawClean.includes('lunge') || rawClean.includes('glute bridge') || rawClean.includes('kickback')) return "Bodyweight Bulgarian Split Squats";
  if (rawClean.includes('squat')) return "Barbell Back Squat";
  if (rawClean.includes('romanian deadlift') || rawClean.includes('rdl')) return "Romanian Deadlift";
  if (rawClean.includes('deadlift')) return "Barbell Deadlift";
  if (rawClean.includes('seated cable row') || rawClean.includes('cable row')) return "Seated Cable Row";
  if (rawClean.includes('banded row') || rawClean.includes('banded lat')) return "Banded Lat Pulldowns or Banded Rows";
  if (rawClean.includes('row')) return "Barbell Row";
  if (rawClean.includes('pull-up') || rawClean.includes('pullup') || rawClean.includes('pull up')) return "Pull-ups";
  if (rawClean.includes('lat pulldown') || rawClean.includes('pulldown')) return "Lat Pulldown (Gym)";
  if (rawClean.includes('leg press') || rawClean.includes('calf raise')) return "Leg Press";
  if (rawClean.includes('leg curl') || rawClean.includes('swiss ball curl') || rawClean.includes('hamstring')) return "Lying Leg Curls";
  if (rawClean.includes('cable bicep') || rawClean.includes('cable curl')) return "Cable Bicep Curls";
  if (rawClean.includes('bicep') || rawClean.includes('hammer curl') || rawClean.includes('curl')) return "Bicep Curls";
  if (rawClean.includes('tricep') || rawClean.includes('pushdown')) return "Tricep Extensions";
  if (rawClean.includes('shrug')) return "Dumbbell Shrugs";
  if (rawClean.includes('face pull')) return "Face Pulls";
  if (rawClean.includes('plank')) return "Plank";
  if (rawClean.includes('hyperextension') || rawClean.includes('cobra') || rawClean.includes('back extension')) return "Hyperextensions (Back Extensions)";
  if (rawClean.includes('knee raise') || rawClean.includes('deadbug') || rawClean.includes('twist') || rawClean.includes('bird-dog') || rawClean.includes('pallof') || rawClean.includes('core')) return "Hanging Knee Raises";
  if (rawClean.includes('walk') || rawClean.includes('cardio') || rawClean.includes('liss') || rawClean.includes('stairmaster') || rawClean.includes('interval')) return "Low Stress Walking - LISS Cardio";

  // Fallback default
  return "Bench Press";
}

module.exports = {
  OFFICIAL_EXERCISES,
  normalizeToOfficialExercise
};
