/**
 * Recommendation Engine for Fitness Buddy
 * Generates custom workout and nutrition plans based on the client health profile.
 */

const { normalizeToOfficialExercise } = require('../utils/exerciseNormalizer');

function generateWorkoutPlan(userId, profile, onboardingData, customSplitKey = null) {
  const conditions = onboardingData.conditions || [];
  const experience = onboardingData.experience || 'BEGINNER';
  const homeOrGym = onboardingData.home_or_gym || onboardingData.homeOrGym || 'GYM';

  let split = 'Full Body Split (Whole Week)';
  let frequency = 3;
  let exercises = [];
  let progressionScheme = 'Linear Progression: Add reps until upper target is hit, then add weight.';

  const isPCOS = conditions.includes('PCOS');
  const hasKneeInjury = conditions.includes('Knee injury') || conditions.includes('Knee pain');

  // Rotator Cuff & joint warmup (unique per day to avoid duplication concerns)
  const getRotatorWarmup = (dayLabel) => ({
    name: `Rotator Cuff Rotations & Joint Mobilization (${dayLabel})`,
    sets: 2,
    reps: '12 per arm',
    restSeconds: 45,
    notes: 'Do light sets to lubricate shoulder joints before training.',
    day: dayLabel
  });

  // Evaluate explicit split selection if provided
  const targetKey = customSplitKey ? customSplitKey.toUpperCase() : null;

  if (targetKey === 'PPL_6DAY') {
    split = 'Push / Pull / Legs (PPL) 6-Day Split';
    frequency = 6;
    exercises = [
      // Day 1: Push A
      getRotatorWarmup('Day 1: Push A'),
      { name: 'Barbell Flat Bench Press', sets: 4, reps: '8-10', restSeconds: 90, notes: 'Keep shoulder blades retracted.', day: 'Day 1: Push A' },
      { name: 'Incline Dumbbell Chest Press', sets: 3, reps: '10-12', restSeconds: 75, notes: 'Control the stretch at bottom.', day: 'Day 1: Push A' },
      { name: 'Standing Overhead Barbell Press', sets: 3, reps: '8-10', restSeconds: 90, notes: 'Brace core, press overhead.', day: 'Day 1: Push A' },
      { name: 'Tricep Rope Pushdowns', sets: 3, reps: '12-15', restSeconds: 60, notes: 'Flare rope at bottom.', day: 'Day 1: Push A' },

      // Day 2: Pull A
      getRotatorWarmup('Day 2: Pull A'),
      { name: 'Barbell Bent-Over Row', sets: 4, reps: '8-10', restSeconds: 90, notes: 'Hinge hips, pull to waist.', day: 'Day 2: Pull A' },
      { name: 'Lat Pulldowns (Wide Grip)', sets: 3, reps: '10-12', restSeconds: 75, notes: 'Squeeze lats at bottom.', day: 'Day 2: Pull A' },
      { name: 'Seated Cable Row', sets: 3, reps: '12', restSeconds: 60, notes: 'Squeeze mid-back.', day: 'Day 2: Pull A' },
      { name: 'Standing Barbell Bicep Curls', sets: 3, reps: '12', restSeconds: 60, notes: 'Strict form, no swinging.', day: 'Day 2: Pull A' },

      // Day 3: Legs A
      { name: 'Barbell Back Squat', sets: 4, reps: '8-10', restSeconds: 120, notes: 'Squat to parallel or lower.', day: 'Day 3: Legs A' },
      { name: 'Dumbbell Romanian Deadlifts', sets: 3, reps: '10-12', restSeconds: 90, notes: 'Hinge hips back.', day: 'Day 3: Legs A' },
      { name: 'Leg Press (Machine)', sets: 3, reps: '12-15', restSeconds: 75, notes: 'Full depth without tailbone tuck.', day: 'Day 3: Legs A' },
      { name: 'Standing Calf Raises', sets: 4, reps: '15-20', restSeconds: 45, notes: 'Full extension.', day: 'Day 3: Legs A' },

      // Day 4: Push B
      getRotatorWarmup('Day 4: Push B'),
      { name: 'Incline Barbell Bench Press', sets: 4, reps: '8-10', restSeconds: 90, notes: '30-degree incline.', day: 'Day 4: Push B' },
      { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12', restSeconds: 75, notes: 'Seated press.', day: 'Day 4: Push B' },
      { name: 'Banded Pec Deck Chest Flyes', sets: 3, reps: '15', restSeconds: 60, notes: 'Peak contraction.', day: 'Day 4: Push B' },
      { name: 'Dumbbell Lateral Raises', sets: 4, reps: '15', restSeconds: 45, notes: 'Control descent.', day: 'Day 4: Push B' },

      // Day 5: Pull B
      getRotatorWarmup('Day 5: Pull B'),
      { name: 'Weighted Pull-Ups', sets: 4, reps: '6-8', restSeconds: 90, notes: 'Full extension at bottom.', day: 'Day 5: Pull B' },
      { name: 'Dumbbell Single-Arm Rows', sets: 3, reps: '10-12', restSeconds: 75, notes: 'Pull dumbbell to hip.', day: 'Day 5: Pull B' },
      { name: 'Standing Cable Face Pulls', sets: 3, reps: '15', restSeconds: 60, notes: 'High pull to rear delts.', day: 'Day 5: Pull B' },
      { name: 'Hammer Curls', sets: 3, reps: '12', restSeconds: 60, notes: 'Target brachialis.', day: 'Day 5: Pull B' },

      // Day 6: Legs B
      { name: 'Barbell Deadlift', sets: 3, reps: '5', restSeconds: 150, notes: 'Heavy compound deadlift.', day: 'Day 6: Legs B' },
      { name: 'Bulgarian Split Squats', sets: 3, reps: '10 per leg', restSeconds: 75, notes: 'Dumbbells at sides.', day: 'Day 6: Legs B' },
      { name: 'Lying Leg Curls', sets: 3, reps: '12-15', restSeconds: 60, notes: 'Hamstring isolation.', day: 'Day 6: Legs B' },
      { name: 'Hanging Knee Raises', sets: 3, reps: '15', restSeconds: 45, notes: 'Core control.', day: 'Day 6: Legs B' }
    ];
    progressionScheme = 'PPL Linear Progression: Add 2.5kg to main lifts once upper rep range target is reached on all sets.';
  } else if (targetKey === 'DESI_HOME_3DAY' || (!targetKey && homeOrGym === 'HOME')) {
    split = 'Desi Home-Fitness 3-Day Split';
    frequency = 3;
    exercises = [
      // Day 1: Upper Focus
      getRotatorWarmup('Day 1: Upper Focus'),
      {
        name: 'Standard Pushups (Knees if needed)',
        sets: 3,
        reps: '10-15',
        restSeconds: 60,
        notes: 'Control descent. Press through chest.',
        day: 'Day 1: Upper Focus'
      },
      {
        name: 'Banded Lat Pulldowns (Door Anchor)',
        sets: 3,
        reps: '12-15',
        restSeconds: 75,
        notes: 'Loop resistance band, squeeze lats at the bottom.',
        day: 'Day 1: Upper Focus'
      },
      {
        name: 'Banded Pec Deck Chest Flyes',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Keep slight bend in elbows, contract chest peak.',
        day: 'Day 1: Upper Focus'
      },
      {
        name: 'Seated Water Bottle/Dumbbell Shoulder Press',
        sets: 3,
        reps: '12',
        restSeconds: 60,
        notes: 'Keep core braced, elbows slightly tucked.',
        day: 'Day 1: Upper Focus'
      },

      // Day 2: Lower Focus
      {
        name: 'Bodyweight Goblet Squats',
        sets: 3,
        reps: '15',
        restSeconds: 90,
        notes: 'Drive knees outward, maintain straight posture.',
        day: 'Day 2: Lower Focus'
      },
      {
        name: 'Home Bulgarian Split Squats',
        sets: 3,
        reps: '10 per leg',
        restSeconds: 75,
        notes: 'Rear foot elevated on bed/couch. Lean slightly forward.',
        day: 'Day 2: Lower Focus'
      },
      {
        name: 'Bodyweight Glute Bridges',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Squeeze glutes at peak. Pause for 1 second.',
        day: 'Day 2: Lower Focus'
      },
      {
        name: 'Standing Single-Leg Calf Raises',
        sets: 3,
        reps: '20 per side',
        restSeconds: 45,
        notes: 'Stand on stair edge, get full stretch and squeeze.',
        day: 'Day 2: Lower Focus'
      },

      // Day 3: Conditioning & Core
      {
        name: 'Forearm Plank Hold',
        sets: 3,
        reps: '45 seconds',
        restSeconds: 60,
        notes: 'Keep body in a straight line, contract core.',
        day: 'Day 3: Conditioning & Core'
      },
      {
        name: 'Russian Twists',
        sets: 3,
        reps: '20 total',
        restSeconds: 60,
        notes: 'Rotate shoulders fully side to side.',
        day: 'Day 3: Conditioning & Core'
      },
      {
        name: 'Bird-Dogs (Alternating)',
        sets: 3,
        reps: '12 per side',
        restSeconds: 45,
        notes: 'Extend opposite arm and leg, hold stability.',
        day: 'Day 3: Conditioning & Core'
      },
      {
        name: 'High Knee Cardio Intervals',
        sets: 3,
        reps: '40 seconds',
        restSeconds: 60,
        notes: 'Pumping arms and knees, light on feet.',
        day: 'Day 3: Conditioning & Core'
      }
    ];
    progressionScheme = 'Home progression: Add 1-2 reps per set each week. If reps exceed 20, increase weight or slow tempo (3s descents).';
  } else if (targetKey === 'PCOS_3DAY' || (!targetKey && isPCOS)) {
    split = 'PCOS 3-Day Low-Cortisol Split';
    frequency = 3;
    exercises = [
      // Day 1: Gentle Upper Body
      getRotatorWarmup('Day 1: Gentle Upper Body'),
      {
        name: 'Dumbbell Flat Bench Press',
        sets: 3,
        reps: '10',
        restSeconds: 75,
        notes: 'Keep 2 reps in reserve. Avoid straining to failure.',
        day: 'Day 1: Gentle Upper Body'
      },
      {
        name: 'Chest-Supported Dumbbell Rows',
        sets: 3,
        reps: '12',
        restSeconds: 90,
        notes: 'Pull elbows to hips, squeeze shoulder blades.',
        day: 'Day 1: Gentle Upper Body'
      },
      {
        name: 'Seated Cable Lat Pulldowns',
        sets: 3,
        reps: '12',
        restSeconds: 75,
        notes: 'Focus on vertical pull. Slow eccentric phase.',
        day: 'Day 1: Gentle Upper Body'
      },
      {
        name: 'Dumbbell Lateral Raises',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Keep shoulders relaxed, raise to sides.',
        day: 'Day 1: Gentle Upper Body'
      },

      // Day 2: Gentle Lower Body
      {
        name: 'Goblet Squats (Tempo 3-0-3)',
        sets: 3,
        reps: '8-10',
        restSeconds: 90,
        notes: 'Focus on breathing control. Low cortisol activation.',
        day: 'Day 2: Gentle Lower Body'
      },
      {
        name: 'Dumbbell Romanian Deadlifts',
        sets: 3,
        reps: '10',
        restSeconds: 90,
        notes: 'Hinge back at the hips, vertical shins.',
        day: 'Day 2: Gentle Lower Body'
      },
      {
        name: 'Weighted Glute Bridges',
        sets: 3,
        reps: '12',
        restSeconds: 75,
        notes: 'Hold at top for 2 seconds. Protects lower back.',
        day: 'Day 2: Gentle Lower Body'
      },
      {
        name: 'Seated Calf Raises',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Controlled ankle extensions.',
        day: 'Day 2: Gentle Lower Body'
      },

      // Day 3: Core & Steady LISS
      {
        name: 'Post-Meal LISS Walk',
        sets: 1,
        reps: '25 mins',
        restSeconds: 0,
        notes: 'Zone 2 steady-state walk to manage glucose levels.',
        day: 'Day 3: Core & Steady LISS'
      },
      {
        name: 'Deadbugs Core Control',
        sets: 3,
        reps: '10 per side',
        restSeconds: 60,
        notes: 'Keep lower back pressed flat into floor.',
        day: 'Day 3: Core & Steady LISS'
      },
      {
        name: 'Prone Cobra Hold',
        sets: 3,
        reps: '30 seconds',
        restSeconds: 45,
        notes: 'Strengthens upper back extensor muscles.',
        day: 'Day 3: Core & Steady LISS'
      }
    ];
    progressionScheme = 'Low-stress progression: Focus on stabilization, core tension, and glucose management over absolute load.';
  } else if (targetKey === 'KNEE_FRIENDLY_3DAY' || (!targetKey && hasKneeInjury)) {
    split = 'Knee-Friendly 3-Day Upper/Lower Split';
    frequency = 3;
    exercises = [
      // Day 1: Knee-Safe Lower Focus
      {
        name: 'Weighted Glute Bridges (Barbell or DB)',
        sets: 4,
        reps: '12-15',
        restSeconds: 75,
        notes: 'Load on hips. Zero knee strain, high glute engagement.',
        day: 'Day 1: Knee-Safe Lower Focus'
      },
      {
        name: 'Hamstring Swiss Ball Curls',
        sets: 3,
        reps: '12',
        restSeconds: 60,
        notes: 'Keep hips elevated as you curl heels in.',
        day: 'Day 1: Knee-Safe Lower Focus'
      },
      {
        name: 'Cable Kickbacks (Glute Focus)',
        sets: 3,
        reps: '12 per side',
        restSeconds: 60,
        notes: 'Lean forward slightly, kick leg backward.',
        day: 'Day 1: Knee-Safe Lower Focus'
      },
      {
        name: 'Standing Calf Raises',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Deep stretch at bottom, squeeze ankles high.',
        day: 'Day 1: Knee-Safe Lower Focus'
      },

      // Day 2: Upper Body Pull & Push
      getRotatorWarmup('Day 2: Upper Body Pull & Push'),
      {
        name: 'Dumbbell Floor Press',
        sets: 3,
        reps: '8-10',
        restSeconds: 90,
        notes: 'Restricting elbow range saves shoulders, no knee use.',
        day: 'Day 2: Upper Body Pull & Push'
      },
      {
        name: 'Lat Pulldowns (Wide Grip)',
        sets: 3,
        reps: '10-12',
        restSeconds: 75,
        notes: 'Pull down to chest, squeeze shoulder blades.',
        day: 'Day 2: Upper Body Pull & Push'
      },
      {
        name: 'Incline Dumbbell Chest Flyes',
        sets: 3,
        reps: '12',
        restSeconds: 60,
        notes: 'Squeeze chest at top, control stretch.',
        day: 'Day 2: Upper Body Pull & Push'
      },
      {
        name: 'Seated Cable Row (Close Grip)',
        sets: 3,
        reps: '10-12',
        restSeconds: 75,
        notes: 'Pull low to belly button, contract upper back.',
        day: 'Day 2: Upper Body Pull & Push'
      },

      // Day 3: Core & Low-Impact Conditioning
      {
        name: 'StairMaster/Incline Walk (No Running)',
        sets: 1,
        reps: '20 mins',
        restSeconds: 0,
        notes: 'Low-impact cardio to build lung capacity.',
        day: 'Day 3: Core & Low-Impact Conditioning'
      },
      {
        name: 'Forearm Side Plank',
        sets: 3,
        reps: '30s per side',
        restSeconds: 60,
        notes: 'Keep hips raised and body straight.',
        day: 'Day 3: Core & Low-Impact Conditioning'
      },
      {
        name: 'Pallof Press (Cable Core)',
        sets: 3,
        reps: '12 per side',
        restSeconds: 60,
        notes: 'Resist rotation, extend arms forward slowly.',
        day: 'Day 3: Core & Low-Impact Conditioning'
      }
    ];
    progressionScheme = 'Injury-free progression: Progress upper body lifts weekly. Lower body movements should remain pain-free.';
  } else if (targetKey === 'UPPER_LOWER_4DAY' || (!targetKey && (experience === 'INTERMEDIATE' || experience === 'ADVANCED'))) {
    split = 'Upper / Lower 4-Day Weekly Split';
    frequency = 4;
    exercises = [
      // Day 1: Upper Body A
      getRotatorWarmup('Day 1: Upper A'),
      {
        name: 'Barbell Flat Bench Press',
        sets: 4,
        reps: '6-8',
        restSeconds: 120,
        notes: 'Keep shoulder blades retracted, touch lower chest.',
        day: 'Day 1: Upper A'
      },
      {
        name: 'Weighted Pull-Ups',
        sets: 3,
        reps: '8',
        restSeconds: 90,
        notes: 'Use a belt or pull bodyweight with controlled eccentric.',
        day: 'Day 1: Upper A'
      },
      {
        name: 'Standing Overhead Barbell Press',
        sets: 3,
        reps: '8',
        restSeconds: 90,
        notes: 'Keep glutes and core tight, press overhead.',
        day: 'Day 1: Upper A'
      },
      {
        name: 'Incline Dumbbell Chest Flyes',
        sets: 3,
        reps: '12',
        restSeconds: 60,
        notes: 'Control chest stretch at bottom.',
        day: 'Day 1: Upper A'
      },

      // Day 2: Lower Body A
      {
        name: 'Barbell Squats (Low Bar)',
        sets: 4,
        reps: '6-8',
        restSeconds: 120,
        notes: 'Drive knees out, descend past parallel.',
        day: 'Day 2: Lower A'
      },
      {
        name: 'Dumbbell Romanian Deadlifts',
        sets: 3,
        reps: '10',
        restSeconds: 90,
        notes: 'Hinge hips backwards, feel stretch in hamstrings.',
        day: 'Day 2: Lower A'
      },
      {
        name: 'Leg Press (Wide/High Foot Placement)',
        sets: 3,
        reps: '10-12',
        restSeconds: 90,
        notes: 'Glute/hamstring bias press. Do not lock knees.',
        day: 'Day 2: Lower A'
      },
      {
        name: 'Hanging Knee Raises',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Avoid swinging, lift knees to chest.',
        day: 'Day 2: Lower A'
      },

      // Day 3: Upper Body B
      getRotatorWarmup('Day 3: Upper B'),
      {
        name: 'Incline Dumbbell Bench Press',
        sets: 3,
        reps: '8-10',
        restSeconds: 90,
        notes: '30-degree incline, control the dumbbells.',
        day: 'Day 3: Upper B'
      },
      {
        name: 'Seated Cable Row (Wide Grip)',
        sets: 3,
        reps: '10-12',
        restSeconds: 75,
        notes: 'Pull low to waist, squeeze mid-back.',
        day: 'Day 3: Upper B'
      },
      {
        name: 'Standing Cable Face Pulls',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Pull to bridge of nose, flare elbows.',
        day: 'Day 3: Upper B'
      },
      {
        name: 'Dumbbell Incline Bicep Curls',
        sets: 3,
        reps: '12',
        restSeconds: 60,
        notes: 'Maximum stretch on biceps at the bottom.',
        day: 'Day 3: Upper B'
      },

      // Day 4: Lower Body B
      {
        name: 'Conventional Barbell Deadlifts',
        sets: 3,
        reps: '5',
        restSeconds: 150,
        notes: 'Brace core, pull bar close to shins.',
        day: 'Day 4: Lower B'
      },
      {
        name: 'Walking Lunges (Dumbbell)',
        sets: 3,
        reps: '10 per leg',
        restSeconds: 75,
        notes: 'Keep knee tracking in line with toes.',
        day: 'Day 4: Lower B'
      },
      {
        name: 'Standing Barbell Calf Raises',
        sets: 4,
        reps: '15',
        restSeconds: 60,
        notes: 'Hold peak contraction for 1 second.',
        day: 'Day 4: Lower B'
      },
      {
        name: 'Forearm Plank to Side Planks',
        sets: 3,
        reps: '60s total',
        restSeconds: 60,
        notes: 'Hold middle 30s, rotate to side for 15s each.',
        day: 'Day 4: Lower B'
      }
    ];
    progressionScheme = 'Double progression: Increase weight when all sets reach upper rep range target.';
  } else {
    // Default Beginner 3-Day Weekly Full-Body Split
    split = 'Beginner 3-Day Weekly Routine';
    frequency = 3;
    exercises = [
      // Day 1: Push Focus
      getRotatorWarmup('Day 1: Push Focus'),
      {
        name: 'Incline Dumbbell Chest Press',
        sets: 3,
        reps: '10',
        restSeconds: 75,
        notes: 'Keep elbows at a 45-degree angle. Press up.',
        day: 'Day 1: Push Focus'
      },
      {
        name: 'Goblet Squat (Dumbbell)',
        sets: 3,
        reps: '10',
        restSeconds: 90,
        notes: 'Go as deep as comfortable with upright posture.',
        day: 'Day 1: Push Focus'
      },
      {
        name: 'Seated Dumbbell Overhead Press',
        sets: 3,
        reps: '10',
        restSeconds: 75,
        notes: 'Keep core braced, press straight up.',
        day: 'Day 1: Push Focus'
      },
      {
        name: 'Cable Triceps Rope Pushdowns',
        sets: 3,
        reps: '12',
        restSeconds: 60,
        notes: 'Keep elbows locked at sides.',
        day: 'Day 1: Push Focus'
      },

      // Day 2: Pull Focus
      {
        name: 'One-Arm Dumbbell Row',
        sets: 3,
        reps: '10 per side',
        restSeconds: 75,
        notes: 'Pull weight to hip crease. Keep back neutral.',
        day: 'Day 2: Pull Focus'
      },
      {
        name: 'Romanian Deadlifts (Dumbbell)',
        sets: 3,
        reps: '10',
        restSeconds: 90,
        notes: 'Hinge hips backwards, feel hamstrings load.',
        day: 'Day 2: Pull Focus'
      },
      {
        name: 'Cable Face Pulls',
        sets: 3,
        reps: '15',
        restSeconds: 60,
        notes: 'Pull rope toward eyes, squeeze upper back.',
        day: 'Day 2: Pull Focus'
      },
      {
        name: 'Standing Alternating Dumbbell Bicep Curls',
        sets: 3,
        reps: '12 per arm',
        restSeconds: 60,
        notes: 'Rotate palms upward as you lift.',
        day: 'Day 2: Pull Focus'
      },

      // Day 3: Legs & Core
      {
        name: 'Glute Bridges (Bodyweight / Light DB)',
        sets: 3,
        reps: '12',
        restSeconds: 60,
        notes: 'Squeeze glutes at the top.',
        day: 'Day 3: Legs & Core'
      },
      {
        name: 'Standing Dumbbell Lunges',
        sets: 3,
        reps: '10 per leg',
        restSeconds: 75,
        notes: 'Step backward, drop hip vertically.',
        day: 'Day 3: Legs & Core'
      },
      {
        name: 'Forearm Plank',
        sets: 3,
        reps: '30-45 seconds',
        restSeconds: 60,
        notes: 'Keep body in a straight line.',
        day: 'Day 3: Legs & Core'
      },
      {
        name: 'Dumbbell Farmers Walks',
        sets: 3,
        reps: '40 meters',
        restSeconds: 60,
        notes: 'Brace core, walk slowly with heavy dumbbells.',
        day: 'Day 3: Legs & Core'
      }
    ];
    progressionScheme = 'Linear progression: Add 1-2 reps per set each week. If upper rep target is met, increase weight next time.';
  }

  // Dynamic day mapper to convert "Day X: ..." to actual calendar days
  const mappedExercises = exercises.map(ex => {
    let dayLabel = ex.day || 'Monday';
    const numMatch = dayLabel.match(/Day (\d+)/i);
    if (numMatch) {
      const dayNum = parseInt(numMatch[1]);
      if (frequency === 2) {
        const twoDayMap = { 1: 'Tuesday', 2: 'Thursday' };
        dayLabel = twoDayMap[dayNum] || 'Tuesday';
      } else if (frequency === 4) {
        const fourDayMap = { 1: 'Monday', 2: 'Tuesday', 3: 'Thursday', 4: 'Friday' };
        dayLabel = fourDayMap[dayNum] || 'Monday';
      } else if (frequency === 5) {
        const fiveDayMap = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Friday', 5: 'Saturday' };
        dayLabel = fiveDayMap[dayNum] || 'Monday';
      } else {
        // Default to 3-day split (Monday, Wednesday, Friday)
        const threeDayMap = { 1: 'Monday', 2: 'Wednesday', 3: 'Friday' };
        dayLabel = threeDayMap[dayNum] || 'Monday';
      }
    }
    const getExerciseId = (name) => {
      const str = (name || '').toLowerCase();
      if (str.includes('rotator')) return 'rotator-cuff';
      if (str.includes('incline') && (str.includes('bench') || str.includes('press') || str.includes('fly'))) return 'db-incline-press';
      if (str.includes('overhead') || str.includes('shoulder press')) return 'overhead-press';
      if (str.includes('bench press') || str.includes('chest press') || str.includes('floor press')) return 'bench-press';
      if (str.includes('goblet')) return 'goblet-squats';
      if (str.includes('split squat') || str.includes('bulgarian') || str.includes('lunge')) return 'bulgarian-split-squats';
      if (str.includes('squat')) return 'barbell-back-squat';
      if (str.includes('romanian deadlift') || str.includes('rdl')) return 'romanian-deadlift';
      if (str.includes('deadlift')) return 'barbell-deadlift';
      if (str.includes('row')) return 'barbell-row';
      if (str.includes('pull-up') || str.includes('pullup') || str.includes('pull up')) return 'pull-ups';
      if (str.includes('lat pulldown') || str.includes('pulldown')) return 'lat-pulldown';
      if (str.includes('leg press')) return 'leg-press';
      if (str.includes('leg curl') || str.includes('swiss ball curl')) return 'lying-leg-curls';
      if (str.includes('bicep') || str.includes('curl')) return 'bicep-curls';
      if (str.includes('tricep') || str.includes('pushdown')) return 'tricep-extensions';
      if (str.includes('pushup') || str.includes('push-up')) return 'pushups';
      if (str.includes('plank')) return 'plank';
      if (str.includes('walk') || str.includes('cardio') || str.includes('liss') || str.includes('stairmaster') || str.includes('knee cardio')) return 'liss-cardio';
      if (str.includes('hyperextension') || str.includes('cobra')) return 'hyperextensions';
      if (str.includes('knee raise') || str.includes('deadbug') || str.includes('twist') || str.includes('bird-dog') || str.includes('pallof')) return 'hanging-knee-raises';
      return 'bench-press';
    };

    const officialName = normalizeToOfficialExercise(ex.name);
    return {
      ...ex,
      name: officialName,
      imageId: ex.imageId || getExerciseId(officialName),
      day: dayLabel
    };
  });

  return {
    user_id: userId,
    split,
    frequency,
    exercises: mappedExercises,
    progression_scheme: progressionScheme,
    generated_by: 'AI',
    version: 1
  };
}

function generateNutritionPlan(userId, profile, onboardingData) {
  const age = parseInt(onboardingData.age) || 30;
  const gender = onboardingData.gender || 'MALE';
  const weight = parseFloat(onboardingData.weight) || 75.0;
  const height = parseFloat(onboardingData.height) || 170.0;
  const goal = onboardingData.goal || 'FAT_LOSS'; 
  const chaiCups = parseInt(onboardingData.chaiCups || onboardingData.chai_cups) || 0;

  // 1. Calculate Basal Metabolic Rate (BMR) - Mifflin-St Jeor
  let bmr = 0;
  if (gender === 'MALE') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // 2. TDEE (Total Daily Energy Expenditure) - assume light activity (1.375)
  let tdee = Math.round(bmr * 1.375);

  // 3. Goal adjustments
  let calories = tdee;
  if (goal === 'FAT_LOSS') {
    calories = Math.round(tdee - 450); 
  } else if (goal === 'MUSCLE_GAIN') {
    calories = Math.round(tdee + 300); 
  } else {
    calories = Math.round(tdee - 150); 
  }

  // Clamping for health safety
  if (gender === 'FEMALE') {
    calories = Math.max(1300, Math.min(2400, calories));
  } else {
    calories = Math.max(1600, Math.min(3200, calories));
  }

  // 4. Macro Splits
  let proteinGrams = Math.round(weight * 2.0);
  if (gender === 'FEMALE') {
    proteinGrams = Math.round(weight * 1.8);
  }
  proteinGrams = Math.max(90, Math.min(180, proteinGrams)); 

  let fatGrams = Math.round((calories * 0.25) / 9);
  
  let proteinCal = proteinGrams * 4;
  let fatCal = fatGrams * 9;
  let carbGrams = Math.round((calories - (proteinCal + fatCal)) / 4);

  // 5. Culturally Adaptive Meal Templates
  const calcMacros = (pct) => `Protein: ~${Math.round(proteinGrams * pct)}g | Carbs: ~${Math.round(carbGrams * pct)}g | Fats: ~${Math.round(fatGrams * pct)}g`;

  let mealTemplates = [];

  if (goal === 'FAT_LOSS') {
    mealTemplates = [
      {
        meal: 'Breakfast',
        options: [
          'Option A: 2 Boiled or scrambled eggs + 2 slices whole wheat bran bread + 1 cup black tea/coffee.',
          'Option B: 1 bowl Oatmeal (50g) cooked in 1 cup low-fat milk + 10 chopped almonds + 1 scoop of whey protein.'
        ],
        target_macro_estimate: calcMacros(0.25)
      },
      {
        meal: 'Lunch',
        options: [
          'Option A: 150g Grilled/Tawa Chicken Breast + 1 whole wheat Roti + 1 large bowl mixed green salad.',
          'Option B: 1 bowl Cooked Daal (Lentils) + 100g low-fat Paneer/Tofu stir-fry + 1 bowl salad.'
        ],
        target_macro_estimate: calcMacros(0.35)
      },
      {
        meal: 'Dinner',
        options: [
          'Option A: 150g Grilled Fish or 2 dry Seekh Kebabs + 1 small Roti + 1 cup steamed mixed seasonal vegetables.',
          'Option B: 150g Dry Chicken Keema + 1 cup boiled white rice.'
        ],
        target_macro_estimate: calcMacros(0.25)
      },
      {
        meal: 'Snacks / Post-Workout',
        options: [
          'Option A: 1 Scoop of Whey Protein in water + 15 almonds.',
          'Option B: 1 cup Skimmed milk tea (chai with stevia) + 2 boiled egg whites.'
        ],
        target_macro_estimate: calcMacros(0.15)
      }
    ];
  } else {
    // Muscle Gain / Recomp
    mealTemplates = [
      {
        meal: 'Breakfast',
        options: [
          'Option A: 3 Scrambled whole eggs + 2-3 slices Bran Bread + 1 glass of milk.',
          'Option B: Oats Shake: 80g Oats + 1 glass milk + 1 scoop Whey + 1 banana + 15 almonds.'
        ],
        target_macro_estimate: calcMacros(0.25)
      },
      {
        meal: 'Lunch',
        options: [
          'Option A: 200g Tawa Chicken Breast + 2 Roti + 1 cup boiled white rice + salad.',
          'Option B: 2 bowls Daal (Lentils) + 1.5 cups rice + 150g boiled chicken breast.'
        ],
        target_macro_estimate: calcMacros(0.35)
      },
      {
        meal: 'Dinner',
        options: [
          'Option A: 200g Mutton or beef mince (Keema) + 2 Rotis + large green salad.',
          'Option B: 200g Grilled Fish + 200g boiled potato wedges + 1.5 cups stir-fried mixed vegetables.'
        ],
        target_macro_estimate: calcMacros(0.25)
      },
      {
        meal: 'Snacks / Post-Workout',
        options: [
          'Option A: 1 scoop Whey + 1 glass milk + 1 large banana + 2 tbsp peanut butter blended.',
          'Option B: 3 Seekh Kebabs wrapped in 1 large flatbread with mint raita.'
        ],
        target_macro_estimate: calcMacros(0.15)
      }
    ];
  }

  // 6. Inject Chai/Coffee optimization tip dynamically if user drinks 3+ cups daily
  if (chaiCups >= 3) {
    mealTemplates.push({
      meal: 'Chai Optimization Warning',
      options: [
        `Chai Control: You log drinking ${chaiCups} cups of chai daily. Traditional milk-tea with sugar is a major source of hidden calories. Swap full-fat milk for low-fat/skimmed milk (like Nestle Milk Pak Lite) and white sugar for stevia/sucralose. This simple change can save you 250-400 kcal per day without giving up your chai habit!`
      ],
      target_macro_estimate: 'Saves: ~250-400 calories daily'
    });
  }

  return {
    user_id: userId,
    calories,
    protein: proteinGrams,
    carbs: carbGrams,
    fats: fatGrams,
    meal_templates: mealTemplates
  };
}

module.exports = {
  generateWorkoutPlan,
  generateNutritionPlan
};
