const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const checkinsRouter = require('./routes/checkins');
const coachRouter = require('./routes/coach');
const chatRouter = require('./routes/chat');
const knowledgeRouter = require('./routes/knowledge');
const exercisesRouter = require('./routes/exercises');
const bloodworkRouter = require('./routes/bloodwork');
const communityRouter = require('./routes/community');
const workoutsRouter = require('./routes/workouts');

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/coach', coachRouter); // roster and resolvers are mapped here
app.use('/api/plans', coachRouter);  // plan overrides are mapped here as well
app.use('/api/chat', chatRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/bloodwork', bloodworkRouter);
app.use('/api/community', communityRouter);
app.use('/api/workouts', workoutsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date() });
});

// Start Server (only if not running in Vercel serverless environment)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
