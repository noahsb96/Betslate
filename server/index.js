import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import betsRouter from './routes/bets.js';
import settingsRouter from './routes/settings.js';
import authRouter from './routes/auth.js';
import recapsRouter from './routes/recaps.js';
import botsRouter from './routes/bots.js';
import { initDatabase } from './database.js';
import { startScheduler } from './scheduler.js';
import { requireAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Required for Render/reverse-proxy deployments
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || !process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', globalLimiter);

await initDatabase();

app.use('/api/auth', authRouter);
app.use('/api/bots', requireAuth, botsRouter);
app.use('/api/bets', requireAuth, betsRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/recaps', requireAuth, recapsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

startScheduler();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📅 Scheduler started - checking every 10 seconds`);
  console.log(`📂 Serving frontend from ${distPath}`);
});
