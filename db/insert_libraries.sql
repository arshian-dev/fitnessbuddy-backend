-- Insert Default Food Library Items
INSERT INTO food_library (name, calories, protein, carbs, fats, serving_unit) VALUES
('Chicken Breast (Cooked)', 165, 31, 0, 3.6, '100g'),
('Basmati Rice (Cooked)', 130, 2.7, 28, 0.3, '100g'),
('Whole Wheat Roti', 120, 4, 20, 3, '1 medium (40g)'),
('Paneer', 265, 18, 1.2, 20, '100g'),
('Yellow Daal (Cooked)', 116, 9, 20, 0.4, '100g'),
('Greek Yogurt', 59, 10, 3.6, 0.4, '100g'),
('Almonds', 579, 21, 21, 49, '100g'),
('Eggs', 155, 13, 1.1, 11, '100g')
ON CONFLICT (name) DO NOTHING;

-- Insert Default Exercise Library Items
INSERT INTO exercises_library (name, category) VALUES
('Barbell Back Squat', 'Lower Body - Quad Focus'),
('Romanian Deadlift', 'Lower Body - Hamstring Focus'),
('Leg Press', 'Lower Body - Quad Focus'),
('Bench Press', 'Upper Body - Push'),
('Overhead Press', 'Upper Body - Push'),
('Pull-ups', 'Upper Body - Pull'),
('Barbell Row', 'Upper Body - Pull'),
('Bicep Curls', 'Arms'),
('Tricep Extensions', 'Arms'),
('Plank', 'Core')
ON CONFLICT (name) DO NOTHING;
