const express = require('express');
const router = express.Router();
const db = require('../db/db');
const { OpenAI } = require('openai');
const { OFFICIAL_EXERCISES, normalizeToOfficialExercise } = require('../utils/exerciseNormalizer');

// cosineSimilarity removed in favor of pgvector

// POST /api/chat - Chat with AI Fitness Buddy
router.post('/', async (req, res) => {
  const { userId, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const query = message.toLowerCase();

  // 1. Fetch user profile, workout plan, and nutrition plan context if userId is provided
  let clientContext = '';
  if (userId) {
    try {
      const profileRes = await db.query('SELECT * FROM health_profiles WHERE user_id = $1', [userId]);
      const workoutRes = await db.query('SELECT * FROM workout_plans WHERE user_id = $1 ORDER BY version DESC, created_at DESC LIMIT 1', [userId]);
      const nutritionRes = await db.query('SELECT * FROM nutrition_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);

      let profileText = 'none';
      if (profileRes.rowCount > 0) {
        const p = profileRes.rows[0];
        profileText = `${p.age}-year-old ${p.gender}, weight ${p.weight}kg, conditions: ${p.conditions.join(', ') || 'none'}, cycle: ${p.cycle_status}, stress: ${p.stress_level}`;
      }

      let workoutText = 'none assigned';
      if (workoutRes.rowCount > 0) {
        const w = workoutRes.rows[0];
        const exerciseList = typeof w.exercises === 'string' ? JSON.parse(w.exercises) : w.exercises;
        workoutText = `Split: "${w.split}", Frequency: ${w.frequency} days/wk, Progression Scheme: "${w.progression_scheme}", Exercises: ${JSON.stringify(exerciseList)}`;
      }

      let nutritionText = 'none assigned';
      if (nutritionRes.rowCount > 0) {
        const n = nutritionRes.rows[0];
        const templates = typeof n.meal_templates === 'string' ? JSON.parse(n.meal_templates) : n.meal_templates;
        nutritionText = `Calories: ${n.calories} kcal, Protein: ${n.protein}g, Carbs: ${n.carbs}g, Fats: ${n.fats}g, Meal Schedule: ${JSON.stringify(templates)}`;
      }

      const bloodworkRes = await db.query('SELECT ai_analysis_summary FROM bloodwork_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
      let bloodworkText = 'none';
      if (bloodworkRes.rowCount > 0) {
        bloodworkText = bloodworkRes.rows[0].ai_analysis_summary;
      }

      clientContext = `[Client Bio: ${profileText}] [Active Workout Program: ${workoutText}] [Active Diet Targets: ${nutritionText}] [Latest Bloodwork Analysis: ${bloodworkText}]`;
    } catch (e) {
      console.error('Failed to fetch comprehensive client context for chat:', e.message);
    }
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
  
  let trainerPrompt = 'You are a fitness and nutrition coaching assistant built into the "Fitness Buddy" app. Keep responses concise and practical.';
  let ragContext = '';
  let trainerId = null;

  if (userId) {
    try {
      const userRes = await db.query('SELECT trainer_id FROM users WHERE id = $1', [userId]);
      if (userRes.rowCount > 0 && userRes.rows[0].trainer_id) {
        trainerId = userRes.rows[0].trainer_id;
        const trainerRes = await db.query('SELECT ai_system_prompt FROM trainers WHERE id = $1', [trainerId]);
        if (trainerRes.rowCount > 0 && trainerRes.rows[0].ai_system_prompt) {
          trainerPrompt = trainerRes.rows[0].ai_system_prompt;
        }
      }
    } catch(e) {
      console.error('Failed to fetch trainer info:', e.message);
    }
  }

  // Generate RAG Context if we have a trainerId and OpenAI Key
  if (trainerId && openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const embedRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
      });
      const queryEmbedding = embedRes.data[0].embedding;

      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const kbRes = await db.query(
        'SELECT content, source_name FROM knowledge_base WHERE trainer_id = $1 ORDER BY embedding <=> $2 LIMIT 10',
        [trainerId, embeddingStr]
      );
      
      const topChunks = kbRes.rows.map(row => ({
        content: row.content,
        source: row.source_name
      }));
      
      if (topChunks.length > 0) {
        ragContext = `\n\n--- KNOWLEDGE BASE CONTEXT ---\nCRITICAL INSTRUCTION: You MUST strictly use the following information to answer the user's question if relevant. When you use this information, you MUST cite the source inline at the end of the sentence like this: "According to [Source: YouTube Video 123]..." or "...(Source: Excel Sheet 1)". Failure to cite the source is a violation of your instructions.\n\n` + 
          topChunks.map(c => `Source: ${c.source}\nContent: ${c.content}`).join('\n\n') + 
          `\n------------------------------\n`;
      }
    } catch(e) {
      console.error('Failed to perform RAG:', e.message);
    }
  }

  // Tool definitions for OpenAI Function Calling
  const tools = [
    {
      type: "function",
      function: {
        name: "update_workout_plan",
        description: "Update or create a new workout plan for the user based on their requests.",
        parameters: {
          type: "object",
          properties: {
            split: { type: "string", description: "Name of the workout split (e.g. Full Body, Push/Pull/Legs)" },
            frequency: { type: "integer", description: "Number of sessions per week" },
            progression_scheme: { type: "string", description: "Progression scheme (e.g. Double Progression)" },
            exercises: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  name: { type: "string" },
                  sets: { type: "integer" },
                  reps: { type: "string" },
                  notes: { type: "string" },
                  day: { type: "string" }
                },
                required: ["name", "sets", "reps", "day"]
              }
            }
          },
          required: ["split", "frequency", "progression_scheme", "exercises"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_nutrition_plan",
        description: "Update the user's nutrition plan including macros and meal templates.",
        parameters: {
          type: "object",
          properties: {
            calories: { type: "integer" },
            protein: { type: "integer" },
            carbs: { type: "integer" },
            fats: { type: "integer" },
            meal_templates: {
              type: "object",
              description: "Suggested meals for the day. E.g. { breakfast: '...', lunch: '...', dinner: '...' }"
            }
          },
          required: ["calories", "protein", "carbs", "fats", "meal_templates"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "log_daily_progress",
        description: "Log the user's daily progress such as weight, calories, or mood. If only partial data is provided, only include those fields.",
        parameters: {
          type: "object",
          properties: {
            weight: { type: "number", description: "User's current weight in kg" },
            energy_score: { type: "integer", description: "Energy score from 1 to 10" },
            mood_score: { type: "integer", description: "Mood score from 1 to 10" },
            calories_logged: { type: "integer" },
            protein_logged: { type: "integer" },
            carbs_logged: { type: "integer" },
            fats_logged: { type: "integer" },
            workouts_completed: { type: "integer", description: "1 if completed today, 0 if not" }
          }
        }
      }
    }
  ];

  // System prompt templates
  const systemPrompt = `${trainerPrompt}

CRITICAL RULES:
1. IDENTITY: Do not use generic AI names. Answer as the persona described above. You are a Virtual Assistant with the ability to manage the user's data.
2. SCOPE: You ONLY answer questions about fitness, exercise, workouts, nutrition, diet, meal planning, and health/wellness.
3. MEDICAL INFO: You have access to the user's Latest Bloodwork Analysis in your context. You ARE ALLOWED to discuss this bloodwork summary and explain how it relates to their fitness, nutrition, and health goals. You are acting as a fitness and nutrition coach reviewing their lab results. Do not claim to be a doctor, but DO provide insights based on the provided analysis.
4. OFF-TOPIC: If the user asks about ANYTHING outside fitness and nutrition politely decline.
5. NO HALLUCINATION & CITATION: Never make up scientific claims. Use the provided Knowledge Base Context. If you use information from the Knowledge Base Context, you MUST cite the source inline (e.g. "According to [Source: YouTube Video 123]...").
6. TOOLS: You have access to tools to update the user's workout plan, nutrition plan, and log their daily progress. USE THESE TOOLS when the user asks you to modify their plan or log their data. If you use a tool, confirm to the user what you have updated.
7. EXERCISE SELECTION: When recommending workouts or calling update_workout_plan, you MUST ONLY select exercises from our official supported exercise catalog below. Do NOT invent new names:
${OFFICIAL_EXERCISES.map(ex => `- ${ex}`).join('\n')}

[CLIENT CONTEXT]
${clientContext}
${ragContext}`;

  // 2. Try OpenAI first (primary)
  if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    try {
      let messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ];

      // We might need to loop if the model calls multiple tools or needs to respond after a tool call.
      let keepGoing = true;
      let finalReply = '';

      while (keepGoing) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: messages,
            tools: tools,
            tool_choice: "auto"
          })
        });

        const json = await response.json();
        if (json.choices && json.choices[0] && json.choices[0].message) {
          const responseMessage = json.choices[0].message;
          messages.push(responseMessage); // Add assistant response to history

          if (responseMessage.tool_calls) {
            // Model wants to call a tool
            for (const toolCall of responseMessage.tool_calls) {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);
              let toolResult = '';

              if (!userId) {
                toolResult = 'Error: Cannot perform action without a logged-in user.';
              } else if (functionName === 'update_workout_plan') {
                try {
                  const lastPlan = await db.query('SELECT version FROM workout_plans WHERE user_id = $1 ORDER BY version DESC LIMIT 1', [userId]);
                  const nextVersion = lastPlan.rowCount > 0 ? lastPlan.rows[0].version + 1 : 1;
                  
                  // Normalize all exercises to official catalog
                  const sanitizedExercises = (functionArgs.exercises || []).map(ex => ({
                    ...ex,
                    name: normalizeToOfficialExercise(ex.name)
                  }));

                  await db.query(
                    `INSERT INTO workout_plans (user_id, split, frequency, exercises, progression_scheme, generated_by, version)
                     VALUES ($1, $2, $3, $4, $5, 'AI', $6)`,
                    [userId, functionArgs.split, functionArgs.frequency || 3, JSON.stringify(sanitizedExercises), functionArgs.progression_scheme || 'Double Progression', nextVersion]
                  );
                  toolResult = `Successfully updated workout plan to version ${nextVersion}.`;
                } catch (e) {
                  toolResult = `Failed to update workout plan: ${e.message}`;
                }
              } else if (functionName === 'update_nutrition_plan') {
                try {
                  await db.query(
                    `INSERT INTO nutrition_plans (user_id, calories, protein, carbs, fats, meal_templates)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [userId, functionArgs.calories, functionArgs.protein, functionArgs.carbs, functionArgs.fats, JSON.stringify(functionArgs.meal_templates)]
                  );
                  toolResult = 'Successfully updated nutrition plan.';
                } catch (e) {
                  toolResult = `Failed to update nutrition plan: ${e.message}`;
                }
              } else if (functionName === 'log_daily_progress') {
                try {
                  // Upsert daily progress for today
                  const today = new Date().toISOString().split('T')[0];
                  
                  // Check if log exists
                  const logCheck = await db.query('SELECT id FROM progress_logs WHERE user_id = $1 AND log_date = $2', [userId, today]);
                  
                  if (logCheck.rowCount > 0) {
                    // Update existing
                    const setClauses = [];
                    const values = [userId, today];
                    let idx = 3;
                    
                    for (const [key, val] of Object.entries(functionArgs)) {
                      setClauses.push(`${key} = $${idx}`);
                      values.push(val);
                      idx++;
                    }
                    
                    if (setClauses.length > 0) {
                      await db.query(`UPDATE progress_logs SET ${setClauses.join(', ')} WHERE user_id = $1 AND log_date = $2`, values);
                    }
                  } else {
                    // Insert new
                    // Fetch existing weight to default if not provided
                    let currentWeight = functionArgs.weight;
                    if (!currentWeight) {
                      const profile = await db.query('SELECT weight FROM health_profiles WHERE user_id = $1', [userId]);
                      currentWeight = profile.rowCount > 0 ? profile.rows[0].weight : 0;
                    }
                    
                    await db.query(
                      `INSERT INTO progress_logs (user_id, log_date, weight, energy_score, mood_score, calories_logged, protein_logged, carbs_logged, fats_logged, workouts_completed)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                      [
                        userId, today, currentWeight, 
                        functionArgs.energy_score || null, functionArgs.mood_score || null,
                        functionArgs.calories_logged || 0, functionArgs.protein_logged || 0,
                        functionArgs.carbs_logged || 0, functionArgs.fats_logged || 0,
                        functionArgs.workouts_completed || 0
                      ]
                    );
                  }
                  toolResult = 'Successfully logged daily progress.';
                } catch (e) {
                  toolResult = `Failed to log daily progress: ${e.message}`;
                }
              }

              messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: toolResult,
              });
            }
          } else {
            // Model returned a final message
            finalReply = responseMessage.content;
            keepGoing = false;
          }
        } else {
          console.warn('OpenAI API response unexpected:', JSON.stringify(json));
          keepGoing = false;
        }
      }

      if (finalReply) {
        return res.json({ reply: finalReply });
      }
    } catch (apiErr) {
      console.error('OpenAI API call failed, trying Gemini fallback...', apiErr.message);
    }
  }

  // 3. Try Gemini as fallback
  if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}
User asks: "${message}"`
            }]
          }]
        })
      });

      const json = await response.json();
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
        let reply = json.candidates[0].content.parts[0].text;
        return res.json({ reply });
      }
    } catch (apiErr) {
      console.error('Gemini fallback also failed, running simulated fallback:', apiErr.message);
    }
  }

  // 4. Simulated Chatbot Fallback
  let reply = '';

  // Intent: Food Swaps / Substitutions
  if (query.includes('swap') || query.includes('substitute') || query.includes('replace') || query.includes('alternative') || query.includes('eat instead')) {
    if (query.includes('chicken')) {
      reply = `To substitute **100g of cooked chicken breast** (approx. 31g Protein, 3g Fat, 150 kcal), here are some macro-equivalent desi options:
- **Seekh Kebab (Chicken or Lean Beef)**: 2 average pieces (approx. 28g Protein, 8g Fat, 200 kcal).
- **Lean Keema (Mince)**: 120g cooked dry (approx. 30g Protein, 6g Fat, 180 kcal).
- **Boiled Eggs**: 4 egg whites + 1 whole egg (approx. 26g Protein, 6g Fat, 160 kcal).
- **Desi Paneer (Cottage Cheese)**: 160g of low-fat paneer (approx. 28g Protein, 8g Fat, 190 kcal).
- **Split Chickpeas (Chana Daal) / Lentils**: 1.5 cups cooked (approx. 18g Protein, 40g Carbs). *Note: Since lentils are high in carbs, reduce your Roti portion by half if choosing this swap!*`;
    } else if (query.includes('egg')) {
      reply = `To substitute **2 whole eggs** (approx. 12g Protein, 10g Fat, 140 kcal), here are your options:
- **Low-Fat Paneer**: 70g paneer grilled or crumbled (approx. 12g Protein, 6g Fat, 110 kcal).
- **Egg Whites**: 4 egg whites (14g Protein, 0g Fat, 60 kcal) scrambled in 1 tsp olive oil or ghee.
- **Greek Yogurt / Dahi**: 1.25 cups of thick yogurt (approx. 15g Protein, 4g Fat, 120 kcal).`;
    } else if (query.includes('roti') || query.includes('rice') || query.includes('carb')) {
      reply = `To swap **1 small Whole Wheat Roti** (approx. 40g raw flour: 120 kcal, 26g Carbs) or **100g cooked White Rice** (130 kcal, 28g Carbs):
- **Sweet Potato (Shakarkandi)**: 120g boiled/roasted (130 kcal, 30g Carbs). Excellent for sustaining energy and controlling insulin.
- **Boiled Oats**: 35g of dry oats cooked in water (approx. 130 kcal, 23g Carbs, 5g Protein).
- **Bran Bread**: 2 slices of whole wheat bran bread (approx. 120 kcal, 24g Carbs).`;
    } else {
      reply = `To help you swap food items, tell me which item you want to replace! Usually, you can swap chicken for kebabs/fish/paneer, eggs for yogurt/paneer, and roti/rice for shakarkandi or oats. Let me know what you have in your kitchen!`;
    }
  }
  // Intent: Shadi / Dawat / Weddings / Eating Out
  else if (query.includes('wedding') || query.includes('shadi') || query.includes('dawat') || query.includes('buffet') || query.includes('restaurant') || query.includes('eat out') || query.includes('cheat')) {
    reply = `Managing South Asian social events (like a Pakistani Shadi or family Dawat) without ruining progress:
1. **Pre-Save Your Calories**: Eat a high-protein, low-calorie snack (like a whey shake or 4 egg whites) 2 hours before leaving. This stops you from arriving starving.
2. **The 3-Section Plate Rule**: Fill 50% of your plate with green salad/sliced cucumber (avoid salad dressings), 40% with dry tandoori/barbque meats (Tikka, Seekh Kebabs, or grilled items), and limit gravy/rice to just 10% (1-2 tablespoons).
3. **Skip Liquid Calories**: Stick to water, mint-lemonade (no sugar), or diet sodas. Avoid the sweet Sherbets or normal colas.
4. **Dessert Portion Control**: Gajar ka Halwa and Gulab Jamuns are loaded with ghee and sugar. Take exactly one teaspoon/bite to satisfy the taste, then stop.`;
  }
  // Intent: Missed Workout / Sick / Traveling
  else if (query.includes('miss') || query.includes('skipped') || query.includes('travel') || query.includes('sick') || query.includes('busy') || query.includes('gym close')) {
    reply = `Life happens, and consistency is about flexibility! Here is how to handle missed sessions:
1. **Do Not Double Up**: Never do two workouts in one day to "catch up" - this will overload your joints and ruin your recovery.
2. **Pick up where you left off**: If you missed Workout 2, perform Workout 2 today. Do not skip it.
3. **Desi Home Workout Option**: If you can't reach the gym, do 3 sets of: Bodyweight Squats (15 reps), Pushups or Knee Pushups (10 reps), Glute Bridges (15 reps), and Plank (45 seconds).
4. **Tighten Nutrition**: When activity is low, stay strict with your calorie target and hit your protein goal to preserve muscle.`;
  }
  // Intent: PCOS / Hormonal Issues
  else if (query.includes('pcos') || query.includes('period') || query.includes('cramp') || query.includes('hormone')) {
    reply = `For clients managing PCOS, the goal is insulin management and stress reduction:
1. **Never Train to Failure**: Heavy, high-exhaustion lifting can spike cortisol (stress hormone), which worsens PCOS symptoms. Leave 2-3 reps in the tank.
2. **Post-Meal Walks**: Make it a non-negotiable habit to walk at a light pace for 10-15 minutes after lunch and dinner. This flattens glucose spikes.
3. **Desi Foods to Avoid/Include**: Avoid refined white flour (Maida in naans/parathas) and sugary chai. Include spices like cinnamon in your oats, turmeric, ginger, and high-fiber lentils/daal.`;
  }
  // Default general response
  else {
    reply = `Hello! I'm your Fitness Buddy assistant. I'm here to help with fitness, nutrition, and health questions.
How can I help you today? Try asking me:
- *"Give me a food swap for 100g chicken breast"*
- *"How do I manage my macros at a wedding buffet?"*
- *"I missed my workout yesterday, what should I do?"*
- *"I have PCOS/knee pain, how does it affect my training?"*`;
  }

  res.json({ reply });
});

// POST /api/chat/estimate-macros - Estimate macros for a food description using AI
router.post('/estimate-macros', async (req, res) => {
  const { foodDescription } = req.body;

  if (!foodDescription || !foodDescription.trim()) {
    return res.status(400).json({ error: 'Food description is required.' });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

  const prompt = `Analyze this food description: "${foodDescription}". 
Calculate the estimated total Calories (kcal), Protein (grams), Carbs (grams), and Fats (grams). 
You must respond with a raw JSON object ONLY, containing the following keys:
- "calories": integer (total calories)
- "protein": integer (total protein grams)
- "carbs": integer (total carb grams)
- "fats": integer (total fat grams)
- "breakdown": a string containing a concise itemized breakdown of the macros for each item.
Do not include any markdown styling, backticks, or "json" prefix. Just return raw JSON.`;

  // 1. Try OpenAI first
  if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const json = await response.json();
      if (json.choices && json.choices[0] && json.choices[0].message) {
        let text = json.choices[0].message.content.trim();
        text = text.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.calories !== undefined) {
          return res.json(parsed);
        }
      }
    } catch (err) {
      console.error('OpenAI macro estimation failed, trying Gemini fallback...', err.message);
    }
  }

  // 2. Try Gemini as fallback
  if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      const json = await response.json();
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
        let text = json.candidates[0].content.parts[0].text.trim();
        text = text.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.calories !== undefined) {
          return res.json(parsed);
        }
      }
    } catch (err) {
      console.error('Gemini fallback macro estimation also failed, running mock calculation:', err.message);
    }
  }

  // 3. Fallback mock calculation for typical South Asian foods if AI is offline
  let calories = 300;
  let protein = 10;
  let carbs = 40;
  let fats = 8;
  let breakdown = "Estimated using offline fallback database.";

  const lower = foodDescription.toLowerCase();
  if (lower.includes('roti') || lower.includes('chapati')) {
    calories = 240; protein = 8; carbs = 52; fats = 2;
    breakdown = "2 Whole Wheat Rotis: ~240 kcal (8g Protein, 52g Carbs, 2g Fats)";
  } else if (lower.includes('chicken') || lower.includes('kebab')) {
    calories = 350; protein = 40; carbs = 5; fats = 18;
    breakdown = "150g Grilled Chicken/Kebabs: ~350 kcal (40g Protein, 5g Carbs, 18g Fats)";
  } else if (lower.includes('daal') || lower.includes('lentil')) {
    calories = 180; protein = 10; carbs = 32; fats = 2;
    breakdown = "1 cup Cooked Daal: ~180 kcal (10g Protein, 32g Carbs, 2g Fats)";
  } else if (lower.includes('egg')) {
    calories = 140; protein = 12; carbs = 1; fats = 10;
    breakdown = "2 Large Boiled Eggs: ~140 kcal (12g Protein, 1g Carbs, 10g Fats)";
  }

  return res.json({ calories, protein, carbs, fats, breakdown });
});

// POST /api/chat/coach - Chat with AI Coach Assistant
router.post('/coach', async (req, res) => {
  const { coachId, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const query = message.toLowerCase();
  
  // System prompt template for the Coach Assistant
  let trainerPrompt = `You are a professional fitness coaching assistant built into the "Fitness Buddy" app.
You do NOT have a name. You are an AI assistant designed to help human fitness coaches manage their client rosters, brainstorm workout splits, analyze nutrition targets, and provide advice on handling difficult coaching scenarios (like client plateaus, injuries, or low adherence).`;

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

  let ragContext = '';
  let trainerId = null;

  try {
    const coachRes = await db.query('SELECT trainer_id FROM users WHERE id = $1', [coachId]);
    if (coachRes.rowCount > 0 && coachRes.rows[0].trainer_id) {
      trainerId = coachRes.rows[0].trainer_id;
      const trainerRes = await db.query('SELECT ai_system_prompt FROM trainers WHERE id = $1', [trainerId]);
      if (trainerRes.rowCount > 0 && trainerRes.rows[0].ai_system_prompt) {
        trainerPrompt = trainerRes.rows[0].ai_system_prompt;
      }
    }
  } catch(e) {
    console.error('Failed to fetch trainer info for coach chat:', e.message);
  }

  // Generate RAG Context if we have a trainerId and OpenAI Key
  if (trainerId && openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    try {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const embedRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
      });
      const queryEmbedding = embedRes.data[0].embedding;

      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const kbRes = await db.query(
        'SELECT content, source_name FROM knowledge_base WHERE trainer_id = $1 ORDER BY embedding <=> $2 LIMIT 10',
        [trainerId, embeddingStr]
      );
      
      const topChunks = kbRes.rows.map(row => ({
        content: row.content,
        source: row.source_name
      }));
      
      if (topChunks.length > 0) {
        ragContext = `\n\n--- KNOWLEDGE BASE CONTEXT ---\nCRITICAL INSTRUCTION: You MUST strictly use the following information to answer the coach's question if relevant. When you use this information, you MUST cite the source inline at the end of the sentence like this: "According to [Source: YouTube Video 123]..." or "...(Source: Excel Sheet 1)". Failure to cite the source is a violation of your instructions.\n\n` + 
          topChunks.map(c => `Source: ${c.source}\nContent: ${c.content}`).join('\n\n') + 
          `\n------------------------------\n`;
      }
    } catch(e) {
      console.error('Failed to perform RAG for coach chat:', e.message);
    }
  }

  const systemPrompt = `${trainerPrompt}

CRITICAL RULES:
1. IDENTITY: You are assisting a COACH. Do not speak to the coach as if they are the client. The coach is asking for advice on how to manage THEIR clients.
2. SCOPE: Answer questions related to fitness programming, nutrition planning, biomechanics, coaching psychology, and business/client management.
3. OFF-TOPIC: If the coach asks about anything outside fitness coaching, politely decline.
4. NO HALLUCINATION & CITATION: Never make up scientific claims or invent studies. Use the provided Knowledge Base Context. If you use information from the Knowledge Base Context, you MUST cite the source inline (e.g. "According to [Source: YouTube Video 123]...").
5. STYLE: Keep responses professional, analytical, and supportive.

If asked for a workout plan or meal plan suggestion, provide it clearly in markdown format. You do not need to use JSON tags for this endpoint since the coach is just brainstorming.

${ragContext}`;

  // 1. Try OpenAI first
  if (openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        })
      });

      const json = await response.json();
      if (json.choices && json.choices[0] && json.choices[0].message) {
        return res.json({ reply: json.choices[0].message.content });
      }
    } catch (apiErr) {
      console.error('OpenAI API call failed for coach chat...', apiErr.message);
    }
  }

  // 2. Try Gemini as fallback
  if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\nCoach asks: "${message}"` }]
          }]
        })
      });

      const json = await response.json();
      if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
        return res.json({ reply: json.candidates[0].content.parts[0].text });
      }
    } catch (apiErr) {
      console.error('Gemini fallback failed for coach chat:', apiErr.message);
    }
  }

  // 3. Fallback mock calculation
  let reply = '';
  if (query.includes('plateau')) {
    reply = `When a client hits a plateau, consider the following steps:\n1. **Review Adherence:** Ensure they are actually sticking to the prescribed macros and not under-reporting calories.\n2. **Diet Break:** If they've been in a deficit for >12 weeks, implement a 1-2 week diet break at maintenance to down-regulate metabolic adaptation.\n3. **Training Volume:** Assess if they are recovering properly. You may need to drop volume (sets/reps) slightly if fatigue is masking fitness.`;
  } else if (query.includes('split') || query.includes('workout')) {
    reply = `For designing a new split, consider their training age and schedule:\n- **Beginners (3 days/week):** Full Body is usually best.\n- **Intermediate (4 days/week):** Upper/Lower split allows good frequency and recovery.\n- **Advanced (5-6 days/week):** Push/Pull/Legs (PPL) works well to manage high volume without joint overuse.\nMake sure to program compounds first, followed by isolations!`;
  } else {
    reply = `Hello Coach! I'm here to help you manage your roster, brainstorm workout progressions, and troubleshoot client adherence issues. What do you need help with?`;
  }

  return res.json({ reply });
});

module.exports = router;
