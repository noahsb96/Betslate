<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BetSlate AI Automator

Automated betting slate analyzer with Discord integration and 24/7 scheduling.

## Features

- **AI Image Analysis**: Upload slate images and let Google Gemini AI extract betting data
- **Discord Integration**: Auto-post bets to Discord via webhooks with role mentions
- **24/7 Scheduling**: Backend scheduler runs continuously to post bets at scheduled times
- **Full-Stack Architecture**: React frontend + Node.js backend + SQLite database

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3001
DATABASE_PATH=./database.db
FRONTEND_URL=http://localhost:5173
```

### 3. Run in Development

**Terminal 1 - Backend Server:**
```bash
npm run server:dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The frontend will be at `http://localhost:5173` and backend at `http://localhost:3001`.

## Production Deployment (PebbleHost)

### Build Frontend
```bash
npm run build
```

The built files will be in the `dist/` folder.

### Run Backend Server
```bash
npm run server
```

The backend will:
- Serve the API on port 3001
- Run the 24/7 scheduler for auto-posting bets
- Store data in SQLite database

### Configure Settings

1. Open the app and click the settings icon
2. Set your **Gemini API Key** (get from Google AI Studio)
3. Set your **Discord Webhook URL** (from Discord channel settings)
4. Configure other settings as needed

## API Endpoints

### Bets
- `GET /api/bets` - Get all bets
- `POST /api/bets` - Create a bet
- `PATCH /api/bets/:id` - Update a bet
- `DELETE /api/bets/:id` - Delete a bet
- `DELETE /api/bets` - Clear all bets

### Settings
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings

## Architecture

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Express.js + Node.js
- **Database**: SQLite with better-sqlite3
- **AI**: Google Generative AI (Gemini)
- **Scheduling**: Server-side interval checker (10s)
- **Discord**: Webhook integration with role mentions

## License

MIT
