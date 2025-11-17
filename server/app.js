const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const multer = require('multer');
require('dotenv').config();

// Import database services
const { userService, chatService, audioCallService, meditationService, quoteService, userStatsService, subscriptionService, memoryService, db, schema, sqlite } = require('./database');

// Initialize database function
async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Create tables if they don't exist
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        avatar TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        role TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS audio_calls (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS meditation_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        meditation_title TEXT NOT NULL,
        duration INTEGER NOT NULL,
        completed_at INTEGER NOT NULL,
        rating INTEGER,
        notes TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        author TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quote_views (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quote_id TEXT NOT NULL,
        viewed_at INTEGER NOT NULL,
        liked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (quote_id) REFERENCES quotes(id)
      );

      CREATE TABLE IF NOT EXISTS user_stats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        total_chat_sessions INTEGER NOT NULL DEFAULT 0,
        total_audio_calls INTEGER NOT NULL DEFAULT 0,
        total_meditation_minutes INTEGER NOT NULL DEFAULT 0,
        total_quotes_viewed INTEGER NOT NULL DEFAULT 0,
        last_activity INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        yookassa_payment_id TEXT,
        started_at INTEGER NOT NULL,
        expires_at INTEGER,
        auto_renew INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        audio_sessions_limit INTEGER,
        audio_sessions_used INTEGER DEFAULT 0,
        last_audio_reset_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    // Execute the SQL to create tables
    sqlite.exec(createTablesSQL);

    console.log('Database tables created successfully!');

    // Check if quotes already exist
    const existingQuotes = await db.select().from(schema.quotes).limit(1);
    if (existingQuotes.length === 0) {
      // Add default quotes
      const defaultQuotes = [
        { text: "Единственный способ сделать что-то хорошо — полюбить то, что вы делаете.", author: "Стив Джобс", category: "Мотивация" },
        { text: "Жизнь — это то, что происходит с вами, пока вы строите другие планы.", author: "Джон Леннон", category: "Жизнь" },
        { text: "Путь в тысячу миль начинается с первого шага.", author: "Лао-цзы", category: "Начинания" },
        { text: "Не важно, как медленно вы идете, главное — не останавливаться.", author: "Конфуций", category: "Настойчивость" },
        { text: "Счастье — это не цель, а способ жить.", author: "Далай-лама", category: "Счастье" }
      ];

      for (const quote of defaultQuotes) {
        await db.insert(schema.quotes).values({
          ...quote,
          createdAt: new Date().getTime(),
        });
      }

      console.log('Default quotes seeded successfully!');
    }

    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

const app = express();
const PORT = process.env.PORT || 1033;

// Middleware
app.use(cors());
app.use(express.json());

// Proxy configuration
const proxyConfig = {
  host: process.env.PROXY_HOST || '185.68.187.20',
  port: process.env.PROXY_PORT || 8000,
  username: process.env.PROXY_USERNAME || 'rBD9e6',
  password: process.env.PROXY_PASSWORD || 'jZdUnJ'
};

const useProxy = process.env.USE_PROXY === 'true';

// Create axios instance with proxy
const createAxiosInstance = () => {
  let agent = undefined;
  
  if (useProxy) {
    // HttpsProxyAgent requires a full URL string with authentication
    const proxyUrl = `http://${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@${proxyConfig.host}:${proxyConfig.port}`;
    agent = new HttpsProxyAgent(proxyUrl);
  }

  return axios.create({
    httpsAgent: agent,
    headers: {
      'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Forwarded-For': 'client'
    },
    timeout: 30000
  });
};

// Chat completions endpoint
app.post('/api/chat/completions', async (req, res) => {
  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.post('https://api.openai.com/v1/chat/completions', req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Audio transcription endpoint
app.post('/api/audio/transcriptions', async (req, res) => {
  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.post('https://api.openai.com/v1/audio/transcriptions', req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Transcription error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Audio speech endpoint
app.post('/api/audio/speech', async (req, res) => {
  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.post('https://api.openai.com/v1/audio/speech', req.body, {
      responseType: 'arraybuffer'
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.length
    });

    res.send(response.data);
  } catch (error) {
    console.error('Speech error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Models endpoint
app.get('/api/models', async (req, res) => {
  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.get('https://api.openai.com/v1/models');
    res.json(response.data);
  } catch (error) {
    console.error('Models error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Database API endpoints

// User endpoints
app.post('/api/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    const user = await userService.getOrCreateUser(email, name);
    res.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/by-email', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await userService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error getting user by email:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userService.updateUser(userId, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoints
app.post('/api/chat/sessions', async (req, res) => {
  try {
    const { userId, title } = req.body;
    const session = await chatService.createChatSession(userId, title);
    res.json(session);
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/chat/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await chatService.endChatSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Error ending chat session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/messages', async (req, res) => {
  try {
    const { sessionId, userId, content, role } = req.body;
    const message = await chatService.addChatMessage(sessionId, userId, content, role);
    res.json(message);
  } catch (error) {
    console.error('Error adding chat message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chat/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await chatService.getChatMessages(sessionId);
    res.json(messages);
  } catch (error) {
    console.error('Error getting chat messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/chat-sessions', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const sessions = await chatService.getUserChatSessions(userId, limit);
    res.json(sessions);
  } catch (error) {
    console.error('Error getting user chat sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Audio call endpoints
app.post('/api/audio-calls', async (req, res) => {
  try {
    const { userId } = req.body;
    const call = await audioCallService.createAudioCall(userId);
    res.json(call);
  } catch (error) {
    console.error('Error creating audio call:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/audio-calls/:callId/end', async (req, res) => {
  try {
    const { callId } = req.params;
    const { duration } = req.body;
    const call = await audioCallService.endAudioCall(callId, duration);
    if (!call) {
      return res.status(404).json({ error: 'Audio call not found' });
    }
    res.json(call);
  } catch (error) {
    console.error('Error ending audio call:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/audio-calls', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const calls = await audioCallService.getUserAudioCalls(userId, limit);
    res.json(calls);
  } catch (error) {
    console.error('Error getting user audio calls:', error);
    res.status(500).json({ error: error.message });
  }
});

// Meditation endpoints
app.post('/api/meditations', async (req, res) => {
  try {
    const { userId, meditationTitle, duration, rating, notes } = req.body;
    const session = await meditationService.createMeditationSession(userId, meditationTitle, duration, rating, notes);
    res.json(session);
  } catch (error) {
    console.error('Error creating meditation session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/meditations', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const sessions = await meditationService.getUserMeditationSessions(userId, limit);
    res.json(sessions);
  } catch (error) {
    console.error('Error getting user meditation sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/meditations/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await meditationService.getUserMeditationStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting user meditation stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quote endpoints
app.get('/api/quotes', async (req, res) => {
  try {
    const quotes = await quoteService.getAllQuotes();
    res.json(quotes);
  } catch (error) {
    console.error('Error getting quotes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quotes/:quoteId/view', async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { userId, liked } = req.body;
    const view = await quoteService.viewQuote(userId, quoteId, liked);
    res.json(view);
  } catch (error) {
    console.error('Error viewing quote:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quotes/:quoteId/toggle-like', async (req, res) => {
  try {
    const { quoteId } = req.params;
    const { userId } = req.body;
    const view = await quoteService.toggleQuoteLike(userId, quoteId);
    res.json(view);
  } catch (error) {
    console.error('Error toggling quote like:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/quotes/views', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const views = await quoteService.getUserQuoteViews(userId, limit);
    res.json(views);
  } catch (error) {
    console.error('Error getting user quote views:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/quotes/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await quoteService.getUserQuoteStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting user quote stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/quotes/liked', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const quotes = await quoteService.getUserLikedQuotes(userId, limit);
    res.json(quotes);
  } catch (error) {
    console.error('Error getting user liked quotes:', error);
    res.status(500).json({ error: error.message });
  }
});

// User stats endpoints
app.get('/api/users/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await userStatsService.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subscription endpoints
app.post('/api/subscriptions', async (req, res) => {
  try {
    const { userId, plan, yookassaPaymentId } = req.body;
    const subscription = await subscriptionService.createSubscription(userId, plan, yookassaPaymentId);
    res.json(subscription);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/subscription', async (req, res) => {
  try {
    const { userId } = req.params;
    const subscription = await subscriptionService.getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json(subscription);
  } catch (error) {
    console.error('Error getting user subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/audio-session-info', async (req, res) => {
  try {
    const { userId } = req.params;
    const info = await subscriptionService.getAudioSessionInfo(userId);
    res.json(info);
  } catch (error) {
    console.error('Error getting audio session info:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/:userId/record-audio-session', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await subscriptionService.recordAudioSession(userId);
    res.json(result);
  } catch (error) {
    console.error('Error recording audio session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize database before starting server
initializeDatabase().then(() => {
  console.log('Database initialized successfully');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Proxy enabled: ${useProxy}`);
  if (useProxy) {
    console.log(`Proxy: ${proxyConfig.host}:${proxyConfig.port}`);
  }
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});


