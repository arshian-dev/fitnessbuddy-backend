-- Schema for Personalized Fitness Intelligence Platform (PostgreSQL)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables to allow recreation of modified columns
DROP TABLE IF EXISTS trainers, users, health_profiles, workout_plans, nutrition_plans, progress_logs, escalation_alerts, exercises_library, food_library, knowledge_base CASCADE;

-- 0. Trainers Table (Multi-Tenant Architecture)
CREATE TABLE IF NOT EXISTS trainers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE, -- e.g., 'noroze'
    ai_system_prompt TEXT, -- Custom instructions for their specific AI
    voice_id VARCHAR(100), -- For ElevenLabs or similar TTS
    avatar_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE, -- Tenant isolation
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('CLIENT', 'COACH', 'ADMIN')),
    coach_code VARCHAR(50) UNIQUE,
    assigned_coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Health Profiles Table
CREATE TABLE IF NOT EXISTS health_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    age INT NOT NULL,
    gender VARCHAR(50) NOT NULL,
    weight FLOAT NOT NULL, -- in kg
    height FLOAT NOT NULL, -- in cm
    conditions TEXT[] DEFAULT '{}', -- e.g., PCOS, Diabetes, Knee injury, None
    medications BOOLEAN DEFAULT FALSE,
    cycle_status VARCHAR(255) DEFAULT 'NOT_APPLICABLE', -- e.g., Regular, Irregular, Menopause, N/A
    stress_level VARCHAR(50) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    sleep_hours FLOAT NOT NULL DEFAULT 7.0,
    adherence_probability FLOAT DEFAULT 0.5, -- computed: 0.0 to 1.0
    recovery_score FLOAT DEFAULT 0.5, -- computed: 0.0 to 1.0
    coaching_complexity VARCHAR(50) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    diet_strictness_tolerance VARCHAR(50) DEFAULT 'MODERATE', -- FLEXIBLE, MODERATE, STRICT
    cooking_control VARCHAR(50) DEFAULT 'FULL', -- FULL, PARTIAL, NONE
    location VARCHAR(255) DEFAULT 'Pakistan',
    occupation VARCHAR(255) DEFAULT 'Employed',
    equipment_access TEXT[] DEFAULT '{}',
    home_or_gym VARCHAR(50) DEFAULT 'GYM',
    chai_cups INT DEFAULT 0,
    water_glasses INT DEFAULT 8,
    sleep_consistency VARCHAR(50) DEFAULT 'CONSISTENT',
    anxiety_depression VARCHAR(100) DEFAULT 'NO',
    bloodwork_status VARCHAR(100) DEFAULT 'NEVER',
    supplement_comfort BOOLEAN DEFAULT TRUE,
    contact_number VARCHAR(100),
    end_goal_description TEXT,
    workout_timing VARCHAR(100) DEFAULT 'EVENING',
    workout_duration VARCHAR(100) DEFAULT '45-60',
    smoking_status VARCHAR(50) DEFAULT 'NO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Workout Plans Table
CREATE TABLE IF NOT EXISTS workout_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    split VARCHAR(255) NOT NULL, -- e.g. Full Body, Push/Pull/Legs, Upper/Lower, PCOS Gentle
    frequency INT NOT NULL, -- sessions per week
    exercises JSONB NOT NULL, -- Array of exercise objects
    progression_scheme TEXT,
    generated_by VARCHAR(50) NOT NULL CHECK (generated_by IN ('AI', 'COACH')),
    version INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Nutrition Plans Table
CREATE TABLE IF NOT EXISTS nutrition_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calories INT NOT NULL,
    protein INT NOT NULL,
    carbs INT NOT NULL,
    fats INT NOT NULL,
    meal_templates JSONB NOT NULL, -- breakfast, lunch, dinner, snacks suggestions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Progress Logs Table
CREATE TABLE IF NOT EXISTS progress_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight FLOAT NOT NULL,
    waist_cm FLOAT,
    energy_score INT CHECK (energy_score BETWEEN 1 AND 10),
    mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
    workouts_completed INT DEFAULT 0,
    workout_completed BOOLEAN DEFAULT FALSE,
    calories_logged INT DEFAULT 0,
    protein_logged INT DEFAULT 0,
    carbs_logged INT DEFAULT 0,
    fats_logged INT DEFAULT 0,
    photo_uris TEXT[] DEFAULT '{}',
    ai_insight TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_date UNIQUE (user_id, log_date)
);

-- 6. Escalation Alerts Table
CREATE TABLE IF NOT EXISTS escalation_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('MEDICAL', 'PSYCHOLOGICAL', 'COMPLIANCE', 'PLATEAU', 'UNREALISTIC')),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    resolved BOOLEAN DEFAULT FALSE,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Exercises Library Table
CREATE TABLE IF NOT EXISTS exercises_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Food Library Table
CREATE TABLE IF NOT EXISTS food_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    calories INT NOT NULL DEFAULT 0,
    protein FLOAT NOT NULL DEFAULT 0.0,
    carbs FLOAT NOT NULL DEFAULT 0.0,
    fats FLOAT NOT NULL DEFAULT 0.0,
    serving_unit VARCHAR(100) NOT NULL DEFAULT '100g',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Knowledge Base Table (For RAG)
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    source_type VARCHAR(50),
    source_name VARCHAR(255),
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast vector similarity search
CREATE INDEX ON knowledge_base USING hnsw (embedding vector_cosine_ops);

-- Seed Data for Multi-Tenant (Noroze Sikandar)
INSERT INTO trainers (name, subdomain, ai_system_prompt)
VALUES (
    'Noroze Sikandar',
    'noroze',
    'You are Noroze Sikandar, a professional fitness trainer. You specialize in South Asian diets, emphasizing cultural foods like daal, roti, and rice but controlled for macros. You communicate directly, motivating your clients, and strictly adhere to the nutrition rules provided in your knowledge base.'
) ON CONFLICT (subdomain) DO NOTHING;

