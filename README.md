# Fitness Buddy - Backend

The backend API for the Personalized Fitness Intelligence Platform, built with Node.js, Express, and PostgreSQL.

## Overview
This robust backend service handles user authentication, profile management, check-ins, coach-client relationships, and AI integration for chat capabilities. It is designed to support the dynamic needs of both fitness clients and coaches.

## Key Features
- **Authentication (`/routes/auth.js`)**: Secure user registration, login, and token management.
- **User Profiles (`/routes/profile.js`)**: Endpoints for managing user goals, metrics, and dietary preferences.
- **Daily Check-ins (`/routes/checkins.js`)**: API for logging daily macro-nutrients, workouts, and progress tracking.
- **Coach Management (`/routes/coach.js`)**: Functionality for coaches to manage clients, view their progress, and handle coach code linking.
- **AI Chat Services (`/routes/chat.js`)**: Integration with AI services to provide intelligent fitness and dietary advice.

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (pg)
- **Environment Management**: dotenv
- **Middleware**: CORS

## Getting Started

### Prerequisites
- Node.js
- PostgreSQL database

### Installation
1. Navigate to the `backend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Setup
Create a `.env` file in the root of the `backend` directory based on the provided `.env.example` file. You will need to configure your database connection string and any necessary API keys (e.g., for AI services).

### Running the Server
To start the server in development mode (with nodemon):
```bash
npm run dev
```
To start the server in production mode:
```bash
npm start
```

## Database Schema
The database uses PostgreSQL and includes tables for users, profiles, check-ins, and coach assignments. Ensure you run the necessary SQL migrations in `db/schema.sql` to initialize your database.
