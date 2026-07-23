# Personalized Fitness Intelligence Platform
## Design Proposal
**Culturally Adaptive Coaching for South Asian Users**

---

### 1. Summary
This document presents the system design proposal for a Personalized Fitness Intelligence Platform targeting educated, high-commitment South Asian users - particularly Pakistani professionals and expats. The platform combines AI-driven recommendations, structured coaching workflows, and human oversight to deliver fitness guidance that is culturally relevant, medically aware, and adherence-focused.

The core problem this platform solves: generic fitness apps fail South Asian users because they recommend westernized meal plans, ignore local cuisine and lifestyle constraints, and provide no meaningful coach interaction. This platform is the answer.

#### 1.1 Product Positioning

| Category | Description |
| :--- | :--- |
| **This is NOT** | A generic calorie tracker, beginner gym app, or static workout library |
| **This IS** | A decision-support system for personalized coaching combining AI intelligence with human expertise |
| **Core Differentiator** | Culturally adaptive fitness intelligence: desi food integration, South Asian health conditions (PCOS, diabetes), real-life adherence strategies |
| **Target User** | Educated professionals, 25-39, PKR 200k+ income, intermediate fitness experience, gym access |

#### 1.2 Ideal Customer Profiles (ICP)
Three primary user archetypes drive the product design:
* **Expat Profile:** "I've been abroad for 4-5 years, gained 15kg, tried two coaches - both gave me chicken-and-broccoli plans I couldn't follow."
* **Male Pakistani Professional:** "I've been lifting 1-2 years, made early progress, but I've been stuck for 6 months. I'm an engineer in Islamabad and don't know what's wrong."
* **Female with PCOS:** "I've tried many routines and diets but can't lose weight. Recommended diets are too westernized. I need something desi and realistic."

---

### 2. Key Use Cases
The following use cases define the primary interactions across all user roles: Client, AI Coaching Assistant, Human Coach, and System.

#### 2.1 Client-Facing Use Cases

| ID | Use Case | Description | Priority |
| :--- | :--- | :--- | :--- |
| **UC-01** | Complete Onboarding Form | Client submits 50+ data-point questionnaire covering demographics, health, lifestyle, nutrition, training history, and psychological readiness. | High |
| **UC-02** | Receive Personalized Plan | System generates a custom workout split, nutrition targets, and recovery guidelines based on the profiling engine output. | High |
| **UC-03** | Log Weekly Check-in | Client submits weight, measurements, energy levels, mood, hunger score, and optional photos each week. | High |
| **UC-04** | Ask AI Assistant | Client queries the AI for meal substitutions, exercise alternatives, missed-workout recovery, or plan clarifications via chat. | High |
| **UC-05** | Track Progress | Client views body metric trends, strength progression graphs, compliance scores, and AI-generated insight summaries. | High |
| **UC-06** | Log Individual Workout | Client marks exercise as complete, logs weights/reps, and rates session difficulty and energy. | Medium |
| **UC-07** | Upload Bloodwork | Client uploads lab results; system flags deficiencies and, if needed, escalates to a coach. | Medium |
| **UC-08** | Social / Event Strategy | Client asks AI for guidance on managing weddings, dining-out, or travel disruptions without derailing progress. | Medium |

#### 2.2 Coach-Facing Use Cases

| ID | Use Case | Description | Priority |
| :--- | :--- | :--- | :--- |
| **UC-09** | Review Client Dashboard | Coach sees full client profile, adherence score, progress charts, AI-generated flags, and weekly check-in history. | High |
| **UC-10** | Override AI Plan | Coach edits workout or nutrition plan, with changes logged and pushed to the client's app instantly. | High |
| **UC-11** | Respond to Escalation Alert | Coach receives and acts on system-generated alerts: plateau detected, compliance failure, medical flag, psychological risk. | High |
| **UC-12** | Send Weekly Feedback | Coach reviews check-in submission and sends personalized written feedback and updated targets. | High |
| **UC-13** | Manage Client Roster | Coach views all active clients sorted by alert priority, compliance score, and last interaction date. | Medium |

#### 2.3 System / AI Use Cases

| ID | Use Case | Description | Priority |
| :--- | :--- | :--- | :--- |
| **UC-14** | Profile Scoring | System converts questionnaire responses into structured scores: recovery capacity, adherence probability, coaching complexity, medical risk flags. | High |
| **UC-15** | Generate Initial Plan | Recommendation engine produces first workout split, macro targets, and meal templates using rules engine + AI. | High |
| **UC-16** | Adaptive Volume Reduction | If client logs poor sleep or high stress for 3+ consecutive days, system automatically reduces training volume and notifies coach. | High |
| **UC-17** | Smart Progress Insight | After each check-in cycle, system generates a narrative insight (e.g., recomp detection, plateau warning, strength trend). | High |
| **UC-18** | Escalation Trigger | System detects medical risk keywords, eating disorder indicators, repeated non-compliance, or unrealistic expectation flags and alerts coach. | High |
| **UC-19** | Meal Substitution Engine | AI maps client-rejected foods to macro-equivalent desi alternatives with adjusted portion guidance. | Medium |
| **UC-20** | Progression Logic | System applies overload rules weekly: if client completes all sets at target reps, weight or reps are incremented on next plan. | Medium |

---

### 3. UML Diagrams

#### 3.1 Use Case Diagram
*(Refer to visual diagram in proposal document)*
The Use Case diagram outlines the interaction between the Client, AI Assistant, Human Coach, and System within the Platform boundary, linking onboarding, check-ins, plan overrides, profile scoring, and escalation triggers.

#### 3.2 System Architecture Diagram for Web App
* **Frontend (React + Tailwind):** Includes Coach Dashboard, Client App, and Admin Panel.
* **Backend (Node.js / Express):** Includes User Profiling Engine, Coach Workflow Service, Progress Tracking Service, Auth Service, Notification & Escalation Service, and Check-in Service.
* **AI Layer:** Includes AI Chat Assistant, Insight Generator, and Rules Engine.
* **External Integrations:** Firebase Auth, OpenAI / Claude API, Cloudinary / S3.
* **Database (PostgreSQL):** Tables for Users / Profiles, Progress Logs, Plans, and Coach Notes.

#### 3.3 User Onboarding Sequence Diagram
1.  **Client → Auth Service:** Submit sign-up form.
2.  **Auth Service → Client:** Register user & return JWT token.
3.  **Client → Profiling Engine:** POST /profile (questionnaire answers).
4.  **Profiling Engine:** Compute recovery score, adherence probability, medical flags.
5.  **Profiling Engine → PostgreSQL:** Save Health Profile.
6.  **Profiling Engine → Recommendation Engine:** Trigger plan generation.
7.  **Recommendation Engine → Rules Engine:** Apply rules (injury, PCOS, sleep, etc.) and adjusted parameters.
8.  **Recommendation Engine → PostgreSQL:** Save Workout Plan + Nutrition Plan.
9.  **Recommendation Engine → Frontend:** Plan ready with Profile + Plan summary.
10. **Frontend → Client:** Show personalized plan.

#### 3.4 Weekly Check-in & Escalation Sequence
1.  **Client → Check-in Service:** Submit check-in (weight, mood, energy, photos).
2.  **Check-in Service → PostgreSQL:** Save ProgressLog.
3.  **Check-in Service → Insight Generator:** Analyse trend.
4.  **Insight Generator:** Detect plateau / recomp / weight spike / streak.
5.  **Insight Generator → PostgreSQL:** Save SmartInsight.
6.  **Insight Generator → Escalation Service:** Evaluate escalation conditions.
7.  *Conditional branches (alt):*
    * **[Medical/Psychological flag detected]:** Escalation Service creates URGENT coach alert → Notification Service pushes notification to Human Coach.
    * **[Compliance failure (missed 2+ check-ins)]:** Escalation Service creates compliance alert → Notification Service sends alert + client summary to Human Coach.
    * **[Normal check-in]:** Display insight summary to Client.
8.  **Human Coach → Check-in Service:** Review + submit feedback.
9.  **Check-in Service → Client:** Feedback notification.

#### 3.5 AI Meal Substitution Flow
1.  **Client:** Sends message: *"I can't eat chicken today"*.
2.  **AI Assistant:** Receives query and extracts intent: `FOOD_SUBSTITUTION`.
3.  **AI Assistant:** Queries client nutrition plan for macro targets and runs the Meal Substitution Engine.
4.  *Conditional Branch:*
    * **Yes (Vegetarian/restriction flag):** Filter plant-based alternatives.
    * **No:** Generate full list (daal, beef, yogurt, whey, eggs).
5.  **System:** Adjusts portion sizes to match protein/calorie target.
6.  **AI Assistant:** Returns suggestions with macro breakdown.
7.  **Client:** Selects alternative.
8.  **System:** Logs substitution for coach visibility.

#### 3.6 Class Diagram (Example Core Domain)
* **User:** `id: UUID`, `name: String`, `email: String`, `role: Enum (CLIENT, COACH, ADMIN)`, `createdAt: DateTime`.
* **Coach Note:** `id: UUID`, `coachId: UUID`, `clientId: UUID`, `note: String`, `planOverride: Boolean`, `createdAt: DateTime`.
* **Health Profile:** `userId: UUID`, `age: Int`, `gender: String`, `weight: Float`, `height: Float`, `conditions: String[]`, `medications: Boolean`, `cycleStatus: String`, `stressLevel: Enum`, `sleepHours: Float`, `adherenceProbability: Float`, `recoveryScore: Float`, `coachingComplexity: Enum`, `location: String`, `occupation: String`, `equipmentAccess: String[]`, `homeOrGym: String`, `chaiCups: Int`, `waterGlasses: Int`, `sleepConsistency: String`, `anxietyDepression: String`, `bloodworkStatus: String`, `supplementComfort: Boolean`, `contactNumber: String`, `endGoalDescription: String`, `workoutTiming: String`, `workoutDuration: String`, `smokingStatus: String`.
* **Workout Plan:** `id: UUID`, `userId: UUID`, `split: String`, `frequency: Int`, `exercises: Exercise[]`, `progressionScheme: String`, `generatedBy: Enum (AI, COACH)`, `version: Int`.
* **Exercise:** `name: String`, `sets: Int`, `reps: String`, `restSeconds: Int`, `notes: String`.
* **NutritionPlan:** `id: UUID`, `userId: UUID`, `calories: Int`, `protein: Int`, `carbs: Int`, `fats: Int`, `mealTemplates: MealTemplate[]`.
* **ProgressLog:** `id: UUID`, `userId: UUID`, `logDate: Date`, `weight: Float`, `waistCm: Float`, `energyScore: Int`, `moodScore: Int`, `workoutsCompleted: Int`, `photoUris: String[]`, `aiInsight: String`.
* **EscalationAlert:** `id: UUID`, `userId: UUID`, `type: Enum (MEDICAL, PSYCHOLOGICAL, COMPLIANCE, UNREALISTIC)`, `severity: Enum (LOW, MEDIUM, HIGH, URGENT)`, `resolved: Boolean`.

---

### 4. System Modules

#### 4.1 User Profiling Engine
Converts the extended onboarding form into a structured, actionable client profile. This module is the foundation of every subsequent recommendation.
* **Recovery Capacity:** Composite of sleep (penalized heavily if sleep < 5.0 hrs or sleep consistency is Irregular/Very Irregular) and stress levels (penalized for High or Very High stress).
* **Adherence Probability:** Calculated using factors like kitchen cooking control (None = 30%, Partial = 60%, Full = 90%), daily chai consumption (penalized if cups >= 3), and sleep consistency.
* **Medical Risk Flag:** Auto-flags for 10+ triggers including Type 2 diabetes, pre-diabetes, hypertension, thyroid issues, PCOS, heart conditions, eating disorders, severe injury, fatty liver, pregnancy, postpartum, diagnosed anxiety/depression, active medication use, sleep < 5.0 hrs, or VERY_HIGH stress.
* **Coaching Complexity:** Automatically set to HIGH if any medical risk triggers, sleep < 5.5 hours, stress is HIGH/VERY_HIGH, or cooking control is NONE. Set to LOW if there are no medical risks, stress is LOW/MEDIUM, sleep is >= 6.5 hours, and cooking control is FULL. Otherwise, defaults to MEDIUM.
* **Diet Strictness Tolerance:** Based on cooking control, family dynamics, and work schedule. Determines how flexible meal templates should be.

#### 4.2 Recommendation Engine
The brain of the platform. Generates workout plans, nutrition targets, and recovery protocols. Operates on a rules engine with AI-ready customization.
* **Desi Home Workout Splits:** Generates custom splits like `Desi Home-Fitness Essentials` using bodyweight, resistance bands, and free weights when the client prefers home training.
* **Rotator Cuff & Joint Warmups:** Prepend a mandatory joint-lubrication rotator cuff warmup protocol to all generated workout splits to ensure joint safety.
* **South Asian Nutrition Mappings:** Meals feature localized Pakistani/South Asian brand options (e.g. Dawn Bran Bread, Nestle Milk Pak, Canolive Oil) and utilize accessible non-scale measurements (e.g., "deck of cards" volume, "tablespoons cooked").
* **Chai Control warnings:** A dynamic optimization warning is injected for clients consuming 3+ cups of chai daily, suggesting low-fat Milk Pak Lite swaps and stevia to cut 250–400 hidden calories.

#### 4.3 Progress Tracking System
Without rigorous tracking, AI recommendations become guesses. The tracking system closes the feedback loop weekly.

| Category Tracked | Metrics | Smart Insight Example |
| :--- | :--- | :--- |
| **Body** | Weight, waist, measurements, photos | "Weight steady 3 weeks, waist −2 cm, strength +12% → recomp phase" |
| **Performance** | Weights lifted, reps, endurance markers | "Bench press up 7.5 kg over 4 weeks — progression on track" |
| **Compliance** | Workouts completed, meal adherence %, steps | "3 missed sessions this week — coach alert triggered" |
| **Recovery** | Sleep hours, energy score, stress score | "5 consecutive poor-sleep days → volume auto-reduced by 20%" |

#### 4.4 AI Coaching Assistant
The AI handles high-frequency repetitive queries, freeing coaches for high-value intervention. It does not replace human oversight — it augments it.
* **Handles:** Food substitutions, exercise swaps, missed-session advice, plan explanations, event strategies, general nutrition Q&A.
* **Escalates to Coach:** Medical symptoms, eating disorder indicators, 3+ missed check-ins, unrealistic target requests, psychological distress signals.
* **Tone:** Context-aware, culturally sensitive, uses Pakistani food/lifestyle references naturally.
* **Memory:** Includes full client profile and recent progress log in every AI context window for personalized responses.

#### 4.5 Coach Dashboard
Coaches are the quality gate of the platform. The dashboard prioritizes their attention on clients who need it most.
* Client roster sorted by alert severity, compliance score, and last check-in date.
* **Detailed Client Profile View:** Renders all 15 new demographic and lifestyle fields (e.g. location, occupation, contact number, sleep consistency, water/chai intake, anxiety/depression, bloodwork status, gym/home split, equipment access) to give coaches full visibility.
* One-click plan override with change log and client notification.
* Weekly check-in review queue with structured feedback submission.
* Escalation alert inbox with severity levels (Low / Medium / High / Urgent) and direct "Mark Resolved" functionality.
* Coach ↔ client direct messaging with response SLA indicators.

#### 4.6 Analytics & Intelligence Layer
The long-term competitive moat. As the platform accumulates outcome data, it learns which plans work for which user profiles — creating a flywheel no competitor can replicate quickly.
* **Aggregate analysis:** Which plans have highest adherence by ICP segment.
* **Churn prediction:** Identify users at risk of dropping off before it happens.
* **Habit correlation:** Which check-in behaviors predict long-term success.
* **AI model improvement:** Fine-tune recommendations based on real outcome data.

---

### 5. Recommended Technology Stack (Web App)

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React + Tailwind CSS | Team already learning React; Tailwind enables rapid, consistent UI development |
| **Backend** | Node.js + Express | Consistent JS across stack; large ecosystem; familiar to team |
| **Database** | PostgreSQL | Relational model fits structured data: users, plans, logs, notes, alerts |
| **Authentication** | Firebase Auth or JWT | Firebase for speed-to-market; JWT if full ownership preferred |
| **AI Integration** | OpenAI / Claude API | Phase 1: API-based. Phase 2: custom fine-tuned models on outcome data |
| **File Storage** | Cloudinary or AWS S3 | Progress photos and bloodwork uploads; Cloudinary simpler for MVP |
| **Notifications** | Firebase FCM / Email | Push for mobile alerts; email for weekly summaries and coach messages |

---

### 6. Human-in-the-Loop: Escalation System
The escalation system is the safety and quality layer that keeps human expertise in the loop. It is non-negotiable for the target ICP who have real medical and psychological sensitivities.

| Trigger Category | Example Conditions / Triggers | Severity | Coach Action & System Behavior |
| :--- | :--- | :--- | :--- |
| **Medical Risk** | PCOS, Thyroid issues, anxiety/depression, postpartum, medications, very high stress, sleep < 5 hrs, or other chronic conditions | **URGENT** | Generates system alert; client sees wait screen: *"Your plan is being personalized by our coach and will be ready within 24 hours. We want to make sure it’s exactly right for you."* |
| **Psychological Risk** | Eating disorder indicators in messages, burnout language, anxiety worsening | **HIGH** | Personal outreach within 24 hrs |
| **Compliance Failure** | 3+ missed check-ins, repeated skipped workouts, no logins in 7 days | **MEDIUM** | Re-engagement message + plan simplification |
| **Plateau Detection** | Weight unchanged 3+ weeks + compliance high | **MEDIUM** | Plan modification recommended |
| **Unrealistic Expectations** | "Lose 5 kg this week", "only 3 hrs sleep, make it work" | **LOW** | AI redirects; coach reviews if repeated |

---

### 7. Key Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **AI gives medically unsafe advice** | HIGH — legal liability, user harm | All medical flags block AI; escalation to coach mandatory; disclaimer on every plan |
| **Low check-in compliance from clients** | HIGH — tracking breaks the feedback loop | Gamified streak tracking; coach nudges; simple mobile-first check-in UX |
| **Coach bandwidth bottleneck** | MEDIUM — coaches can't scale | AI handles 80% of queries; coaches only receive escalated cases; async workflow |
| **Westernized nutrition data in AI models** | MEDIUM — poor food recommendations | Custom desi food database; prompt engineering with Pakistani context; human review |
| **Data privacy (bloodwork, photos)** | MEDIUM — sensitive personal data | Encrypted storage, clear consent, GDPR-aligned privacy policy |

---

### 8. Recommended Next Steps
1. **Phase 1 [COMPLETED]**:
   - Extended database schema and seed data.
   - Built the 5-step React Onboarding Wizard collecting all demographic and habit fields.
   - Built the Profiling Engine with recovery, adherence scoring, and medical flag triggers.
   - Built the Recommendation Rules Engine supporting home workouts, cuff warmups, local brands, portion guides, and chai warnings.
   - Built the Coach Dashboard workspace displaying all 15 new columns, active alerts, and support for alert resolution.
2. **Phase 2 (Upcoming)**:
   - Onboard 5–10 beta clients to collect feedback on plan quality, portion accessibility, and warnings.
   - Implement the AI Chat Assistant (UC-04) supporting general questions and meal substitutions.
   - Integrate bloodwork parsing logic (UC-07) and adaptive volume reductions based on checkin trends.

*This document is the master architectural design. Implementation details are kept updated as the platform evolves.*