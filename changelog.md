# Changelog

## 1. Nutrition Tracking & Exact Quantities
* **Macro Budgeting Widget**: Added a dynamic daily tracker in the Nutrition tab that computes and displays remaining calories, protein, carbs, and fats by subtracting logged totals from the user's personalized targets.
* **Precise Undo Logic**: Upgraded the `loggedMeals` internal state to store exact macro values rather than simple booleans. This prevents data drift when hitting "Undo," guaranteeing that the exact nutritional values logged are seamlessly reversed.
* **Log Exact Macros Modal**: Created an interactive popup when logging a meal that allows for exact calorie and macro tracking, complete with an "Auto" button that derives total calories using the standard 4-4-9 formula (Protein/Carbs x4, Fats x9).
* **AI Quantity Generation**: Overhauled the backend `recommendationEngine.js` to provide explicit, real-world quantities (e.g., "150g Grilled Chicken", "2 whole eggs") in generated meal plans instead of vague "Portioned to hit targets" instructions.
* **Portion Size Multiplier**: Embedded a dynamic slider inside the "Log Exact Macros" modal. Users can quickly declare they ate a `1.5x` or `0.5x` portion, and the system automatically recalculates the meal's exact macros.
* **Unrestricted Macro Editing**: Removed the strict constraint that limited the Custom Macro Modal strictly to users with `CALORIE_COUNTED` preferences. Now, the customized modal opens for all users whenever they click "Log Meal."

## 2. Diet Regeneration Integration
* **Backend Regeneration Endpoint**: Created a brand new `POST /api/profile/regenerate-diet` route in `profile.js` to securely trigger the AI generator and create a fresh nutrition plan utilizing the user's existing health profile record.
* **Frontend Action Button**: Placed a "Regenerate Diet" button directly on the Client Dashboard's Nutrition schedule. The button features loading states and instantly updates the UI with the fresh plan, while gracefully resetting the current day's tracked macros to align with the new schedule.

## 3. AI Chat Enhancements
* **Multi-line Input (Shift+Enter)**: Swapped standard text inputs with auto-expanding textareas in both `ClientDashboard.jsx` and `CoachDashboard.jsx` so users can compose large, multi-line prompts via `Shift+Enter`.
* **Chat Rendering Fix**: Appended the `whitespace-pre-wrap` CSS utility to chat bubbles to ensure that line breaks are properly preserved and rendered on screen when the AI or user sends formatted lists or separated paragraphs.
* **Better Nutrition AI Prompts**: Re-wrote the "Ask Nutrition AI" widget's descriptive text and placeholder to clearly instruct the user to provide cooking methods and specific quantities (e.g., "150g chicken pan-fried in 1 tbsp oil"), dramatically improving the AI's estimation accuracy.

## 4. Stability & Bug Fixes
* **Workout Rest Timer Desync**: Refactored `WorkoutPlayer.jsx` to rely natively on `TimerContext`. Resolved an issue where manual +15s/-15s timer adjustments did not immediately trigger UI updates for the current set.
* **Light Mode Legibility**: Addressed multiple inconsistencies where text remained white on a white background during Light Mode, particularly fixing legibility in the `PlateCalculator.jsx`.
* **Syntax Error Hotfix**: Diagnosed and repaired a build-breaking unterminated `<div>` syntax error in `ClientDashboard.jsx` following a rapid deployment.

## 5. Client Accounts & Coach Roster Management (July 24, 2026)
* **New Client Accounts**: Created and initialized 4 new client profiles in the PostgreSQL database:
  * **Rozain**: `rozain@test.com` (Muscle Gain & Strength)
  * **Nuqta**: `nuqta@test.com` (PCOS Management & Fat Loss)
  * **Provit**: `provit@test.com` (Athletic Recomp & Performance)
  * **Numa**: `numa@test.com` (Fat Loss & Body Toning)
* **Coach Assignment**: Automatically linked all 4 client accounts to Coach Noroze Sikandar (`coach@test.com`) for direct roster management in the Coach Dashboard.
* **Full Profile & Plan Seeding**: Computed health profiles (recovery scores, adherence probabilities, medical flags), generated custom workout splits and nutrition schedules, and seeded initial check-in logs using `create_requested_clients.js`.


