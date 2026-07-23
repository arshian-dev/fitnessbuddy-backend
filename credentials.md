# Fitness Buddy Test Accounts & Credentials

This document provides a comprehensive list of credentials for manual testing of the **Fitness Buddy** application. 

Since authentication is handled via a **local passwordless email sign-in**, you only need the **email address** to access any of these profiles.

---

### 🔑 Active System Accounts

| Name | Role | Email | Profile Characteristics | Assigned Coach |
| :--- | :--- | :--- | :--- | :--- |
| **Coach Noroze Sikandar** | `COACH` | `coach@test.com` | Oversees all clients, manages exercise/food libraries, and overrides plans. | — |
| **Rozain** | `CLIENT` | `rozain@test.com` | Muscle gain & strength focus. Full Body Gym split. | Coach Noroze Sikandar (`coach@test.com`) |
| **Nuqta** | `CLIENT` | `nuqta@test.com` | PCOS management & fat loss focus. Home workout split & high stress adjustments. | Coach Noroze Sikandar (`coach@test.com`) |
| **Provit** | `CLIENT` | `provit@test.com` | Athletic performance & body recomposition. 4-day gym split. | Coach Noroze Sikandar (`coach@test.com`) |
| **Numa** | `CLIENT` | `numa@test.com` | Fat loss & body toning. Balanced macro targets & 45-60 min gym sessions. | Coach Noroze Sikandar (`coach@test.com`) |

---

## 🆕 Registering Additional Clients (Fresh Testing)

To test client onboarding manually from scratch:
1. Go to the landing page at `http://localhost:5173/`.
2. Scroll to the **Fitness Buddy Portal** section.
3. Click on the **Register Client Account** link.
4. Enter any Name and Email address, select the **Client** role, and submit.
5. You will be directed straight to the **Onboarding Wizard** where you can select health goals/conditions and generate a custom plan.
6. Once completed, sign out and log back in as `coach@test.com` to see the fresh profile listed in the coach roster.
