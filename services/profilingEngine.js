/**
 * Profiling Engine for Fitness Buddy
 * Computes scores based on onboarding questionnaire data.
 */

function computeProfile(data) {
  const age = parseInt(data.age) || 30;
  const gender = data.gender || 'MALE';
  const weight = parseFloat(data.weight) || 75.0;
  const height = parseFloat(data.height) || 170.0;
  const conditions = data.conditions || []; // e.g., ['PCOS', 'Hypertension (high BP)']
  const medications = !!data.medications;
  const cycleStatus = data.cycleStatus || 'NOT_APPLICABLE';
  const stressLevel = (data.stressLevel || 'MEDIUM').toUpperCase();
  const sleepHours = parseFloat(data.sleepHours) || 7.0;
  const dietStrictnessTolerance = (data.dietStrictnessTolerance || 'MODERATE').toUpperCase();
  const cookingControl = (data.cookingControl || 'FULL').toUpperCase();
  
  // New metrics from Drive questionnaire
  const location = data.location || 'Pakistan';
  const occupation = data.occupation || 'Employed';
  const chaiCups = parseInt(data.chaiCups) || 0;
  const waterGlasses = parseInt(data.waterGlasses) || 8;
  const sleepConsistency = (data.sleepConsistency || 'CONSISTENT').toUpperCase();
  const anxietyDepression = (data.anxietyDepression || 'NO').toUpperCase();
  const bloodworkStatus = (data.bloodworkStatus || 'NEVER').toUpperCase();
  const smokingStatus = (data.smokingStatus || 'NO').toUpperCase();

  // 1. Calculate Recovery Capacity Score (0.0 to 1.0)
  let recoveryScore = 0.5; // default base
  
  // Sleep hours
  if (sleepHours >= 8) recoveryScore += 0.2;
  else if (sleepHours < 6 && sleepHours >= 5) recoveryScore -= 0.15;
  else if (sleepHours < 5) recoveryScore -= 0.3; // High penalty
  
  // Sleep consistency
  if (sleepConsistency === 'VERY_IRREGULAR') recoveryScore -= 0.1;
  else if (sleepConsistency === 'IRREGULAR') recoveryScore -= 0.05;

  // Stress Level
  if (stressLevel === 'LOW') recoveryScore += 0.1;
  else if (stressLevel === 'HIGH') recoveryScore -= 0.15;
  else if (stressLevel === 'VERY_HIGH') recoveryScore -= 0.25;

  // Medical conditions impact on recovery
  const conditionsImpactList = [
    'Type 2 Diabetes',
    'Pre-diabetes / insulin resistance',
    'Hypertension (high BP)',
    'Hypothyroidism / Hyperthyroidism',
    'PCOS',
    'Heart condition',
    'Eating disorder',
    'Chest pain',
    'Severe injury',
    'Fatty liver'
  ];
  
  conditions.forEach(c => {
    if (conditionsImpactList.includes(c)) {
      recoveryScore -= 0.1;
    }
  });

  // Smoking
  if (smokingStatus === 'REGULARLY') recoveryScore -= 0.1;
  else if (smokingStatus === 'OCCASIONALLY') recoveryScore -= 0.05;

  recoveryScore = Math.max(0.1, Math.min(1.0, recoveryScore));

  // 2. Calculate Adherence Probability (0.0 to 1.0)
  let adherenceScore = 0.5;
  
  // Cooking control
  if (cookingControl === 'FULL') adherenceScore += 0.15;
  else if (cookingControl === 'NONE') adherenceScore -= 0.15;

  // Diet tolerance strictness
  if (dietStrictnessTolerance === 'FLEXIBLE') adherenceScore += 0.1;
  else if (dietStrictnessTolerance === 'STRICT') adherenceScore -= 0.15;

  // Stress and sleep pressure
  if (stressLevel === 'HIGH' || stressLevel === 'VERY_HIGH') adherenceScore -= 0.1;
  if (sleepHours < 6) adherenceScore -= 0.05;

  // Chai dependency (sugar and snack calories association in South Asian lifestyles)
  if (chaiCups >= 3 && chaiCups < 5) adherenceScore -= 0.05;
  else if (chaiCups >= 5) adherenceScore -= 0.12;

  adherenceScore = Math.max(0.1, Math.min(1.0, adherenceScore));

  // 3. Detect Medical Risk Flags & Auto-Escalation triggers (Drive Docs rules)
  const highRiskConditions = [
    'Type 2 Diabetes',
    'Pre-diabetes / insulin resistance',
    'Hypertension (high BP)',
    'Hypothyroidism / Hyperthyroidism',
    'PCOS',
    'Heart condition',
    'Eating disorder',
    'Chest pain',
    'Severe injury',
    'Fatty liver'
  ];
  
  const detectedRiskFlags = conditions.filter(c => highRiskConditions.includes(c));
  
  if (sleepHours < 5.0) detectedRiskFlags.push('Sleep below 5 hours');
  if (stressLevel === 'VERY_HIGH') detectedRiskFlags.push('Very High Stress');
  if (cycleStatus === 'PREGNANT' || cycleStatus === 'POSTPARTUM') {
    detectedRiskFlags.push(`Maternal status: ${cycleStatus}`);
  }
  if (anxietyDepression === 'DIAGNOSED_MED' || anxietyDepression === 'DIAGNOSED_NO_MED') {
    detectedRiskFlags.push(`Anxiety/Depression diagnosis: ${anxietyDepression}`);
  }
  if (medications) {
    detectedRiskFlags.push('Active prescription medication use');
  }

  const hasMedicalRisk = detectedRiskFlags.length > 0;

  // 4. Calculate Coaching Complexity (LOW, MEDIUM, HIGH)
  let coachingComplexity = 'MEDIUM';
  
  const hasMultipleConditions = conditions.length >= 2;
  const isPCOS = conditions.includes('PCOS');
  const isDiabetic = conditions.includes('Type 2 Diabetes') || conditions.includes('Pre-diabetes / insulin resistance');
  
  if (hasMedicalRisk || isPCOS || isDiabetic || (sleepHours < 6 && stressLevel === 'HIGH') || hasMultipleConditions) {
    coachingComplexity = 'HIGH';
  } else if (conditions.length === 0 && sleepHours >= 7 && stressLevel !== 'HIGH' && cookingControl === 'FULL') {
    coachingComplexity = 'LOW';
  }

  return {
    recoveryScore: Math.round(recoveryScore * 100) / 100,
    adherenceProbability: Math.round(adherenceScore * 100) / 100,
    coachingComplexity,
    medicalRiskFlags: detectedRiskFlags,
    hasMedicalRisk
  };
}

module.exports = {
  computeProfile
};
