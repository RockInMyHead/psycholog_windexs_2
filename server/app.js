const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const multer = require('multer');
const FormData = require('form-data');
const OpenAI = require('openai');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
require('dotenv').config();

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Import database services
const { userService, chatService, audioCallService, meditationService, quoteService, userStatsService, subscriptionService, memoryService, userProfileService, accessService, db, schema, sqlite } = require('./database');
const logger = require('./logger');

// Audio conversion function
const convertAudioToWav = (inputBuffer, inputFormat) => {
  return new Promise((resolve, reject) => {
    const tempInputPath = path.join(__dirname, `temp_input_${Date.now()}.${inputFormat}`);
    const tempOutputPath = path.join(__dirname, `temp_output_${Date.now()}.wav`);

    // Write input buffer to temp file
    fs.writeFileSync(tempInputPath, inputBuffer);

    ffmpeg(tempInputPath)
      .toFormat('wav')
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => {
        try {
          const outputBuffer = fs.readFileSync(tempOutputPath);
          // Clean up temp files
          fs.unlinkSync(tempInputPath);
          fs.unlinkSync(tempOutputPath);
          resolve(outputBuffer);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (err) => {
        // Clean up temp files on error
        try {
          if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
          if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
        } catch (cleanupError) {
          logger.warn('CLEANUP', `Failed to cleanup temp files: ${cleanupError.message}`);
        }
        reject(err);
      })
      .save(tempOutputPath);
  });
};

// Initialize database function
async function initializeDatabase() {
  try {
    logger.info('DB', 'Initializing database...');

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

      CREATE TABLE IF NOT EXISTS conversation_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        session_type TEXT NOT NULL,
        user_message TEXT NOT NULL,
        assistant_message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        personality_traits TEXT,
        communication_style TEXT,
        current_concerns TEXT,
        emotional_state TEXT,
        stress_triggers TEXT,
        interests TEXT,
        dislikes TEXT,
        "values" TEXT,
        work_life TEXT,
        relationships TEXT,
        family TEXT,
        health TEXT,
        discussed_topics TEXT,
        recurring_themes TEXT,
        session_count INTEGER DEFAULT 0,
        last_session_date INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

    `;

    // Execute the SQL to create tables
    sqlite.exec(createTablesSQL);

    // Добавляем новые поля в таблицу subscriptions, если они не существуют
    try {
      sqlite.exec('ALTER TABLE subscriptions ADD COLUMN meditation_access INTEGER DEFAULT 0;');
    } catch (error) {
      // Игнорируем ошибку, если колонка уже существует
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
    }

    try {
      sqlite.exec('ALTER TABLE subscriptions ADD COLUMN free_sessions_remaining INTEGER DEFAULT 0;');
    } catch (error) {
      // Игнорируем ошибку, если колонка уже существует
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
    }

    logger.info('DB', 'Database tables created successfully!');

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
        // Generate a proper ID using the same format as createId from @paralleldrive/cuid2
        const quoteId = `quote_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        await db.insert(schema.quotes).values({
          id: quoteId,
          ...quote,
          createdAt: new Date().getTime(),
        });
      }

      logger.info('DB', 'Default quotes seeded successfully!');
    }

    logger.info('DB', 'Database initialized successfully!');
  } catch (error) {
    logger.error('DB', 'Ошибка initialization', error);
    console.error('Database initialization error details:', error);
    throw error;
  }
}

const app = express();
const PORT = process.env.PORT || 1033;
// USE_HTTPS should be explicitly set, not auto-enabled in production
// In production, SSL is usually handled by Nginx reverse proxy, not Node.js
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Middleware
app.use(cors({
  origin: [
    'https://psycholog.windexs.ru'
  ],
  credentials: true
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

app.use(express.json());

// Proxy configuration
const proxyConfig = {
  host: process.env.PROXY_HOST || '185.68.187.20',
  port: process.env.PROXY_PORT || 8000,
  username: process.env.PROXY_USERNAME || 'rBD9e6',
  password: process.env.PROXY_PASSWORD || 'jZdUnJ'
};

const useProxy = process.env.USE_PROXY === 'true';

// Initialize OpenAI client (after proxy flags are defined)
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  ...(useProxy ? {
    httpAgent: new HttpsProxyAgent(`http://${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@${proxyConfig.host}:${proxyConfig.port}`)
  } : {})
});

// Create axios instance with proxy
const createAxiosInstance = () => {
  let agent = undefined;

  if (useProxy) {
    // HttpsProxyAgent requires a full URL string with authentication
    const proxyUrl = `http://${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@${proxyConfig.host}:${proxyConfig.port}`;
    agent = new HttpsProxyAgent(proxyUrl);
    logger.debug('PROXY', `Using proxy: ${proxyConfig.host}:${proxyConfig.port}`);
  } else {
    logger.debug('PROXY', 'Direct connection to OpenAI (no proxy)');
  }

  const instance = axios.create({
    httpsAgent: agent,
    headers: {
      'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Forwarded-For': 'client'
    },
    timeout: 5000
  });

  // Add response interceptor for debugging
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      logger.error('AXIOS', `Request failed: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        proxyUsed: useProxy
      });
      return Promise.reject(error);
    }
  );

  return instance;
};

// Chat completions endpoint
app.post('/api/chat/completions', async (req, res) => {
  try {
    const axiosInstance = createAxiosInstance();

    const body = req.body || {};
    const msgCount = Array.isArray(body.messages) ? body.messages.length : 0;
    const model = body.model || 'unknown';

    logger.debug('CHAT', `Sending chat completion | model=${model} | messages=${msgCount} | max_tokens=${body.max_tokens || 'default'} | temperature=${body.temperature ?? 'default'}`);

    const response = await axiosInstance.post('https://api.openai.com/v1/chat/completions', body, {
      timeout: 30000 // allow longer for audio/TTS use-cases
    });
    res.json(response.data);
  } catch (error) {
    logger.error('CHAT', `Chat completion failed: ${error.message}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      proxyUsed: useProxy,
      requestSummary: {
        model: req.body?.model,
        messages: Array.isArray(req.body?.messages) ? req.body.messages.length : 0,
        max_tokens: req.body?.max_tokens,
        temperature: req.body?.temperature
      }
    });

    logger.openai.error('chat completion', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Audio transcription endpoint
app.post('/api/audio/transcriptions', upload.single('file'), async (req, res) => {
  let convertedBuffer = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.debug('TRANSCRIPTION', `Received file: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

    const axiosInstance = createAxiosInstance();
    const formData = new FormData();

    let audioBuffer = req.file.buffer;
    let filename = req.file.originalname || 'audio.wav';
    let mimetype = req.file.mimetype;

    // Convert MP4 to WAV for better OpenAI Whisper compatibility
    if (req.file.mimetype === 'audio/mp4') {
      logger.debug('TRANSCRIPTION', 'Converting MP4 to WAV for better compatibility...');
      try {
        convertedBuffer = await convertAudioToWav(req.file.buffer, 'mp4');
        audioBuffer = convertedBuffer;
        filename = filename.replace(/\.[^/.]+$/, '.wav');
        mimetype = 'audio/wav';
        logger.debug('TRANSCRIPTION', `Conversion successful: ${convertedBuffer.length} bytes`);
      } catch (conversionError) {
        logger.warn('TRANSCRIPTION', `MP4 conversion failed, using original: ${conversionError.message}`);
        // Continue with original MP4 file if conversion fails
        filename = filename.replace(/\.[^/.]+$/, '.mp4');
      }
    } else {
      // Ensure correct extension for other formats
      if (req.file.mimetype === 'audio/webm') {
        filename = filename.replace(/\.[^/.]+$/, '.webm');
      } else if (req.file.mimetype === 'audio/wav') {
        filename = filename.replace(/\.[^/.]+$/, '.wav');
      } else if (req.file.mimetype === 'audio/mpeg' || req.file.mimetype === 'audio/mp3') {
        filename = filename.replace(/\.[^/.]+$/, '.mp3');
      }
    }

    // Add the file to form data
    formData.append('file', audioBuffer, {
      filename: filename,
      contentType: mimetype
    });

    // Force whisper-1 model as it's the only one for transcription
    formData.append('model', 'whisper-1');

    // Pass other parameters if present
    if (req.body.language) formData.append('language', req.body.language);
    if (req.body.response_format) formData.append('response_format', req.body.response_format);
    if (req.body.prompt) formData.append('prompt', req.body.prompt);

    logger.debug('TRANSCRIPTION', `Sending to OpenAI: model=whisper-1, language=${req.body.language}, format=${req.body.response_format}, final_type=${mimetype}`);
    logger.openai.request('transcription', null);

    const response = await axiosInstance.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': undefined // Let axios/form-data set the correct Content-Type with boundary
      },
      timeout: 30000 // 30 second timeout for transcription
    });

    logger.debug('TRANSCRIPTION', `OpenAI response received successfully`);
    res.json(response.data);

  } catch (error) {
    logger.error('TRANSCRIPTION', `Transcription failed: ${error.message}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null,
      proxyEnabled: useProxy,
      converted: convertedBuffer !== null,
      stack: error.stack
    });

    logger.openai.error('transcription', error);
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
    logger.openai.error('speech synthesis', error);
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
    logger.openai.error('models request', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

// Test OpenAI transcription endpoint
app.post('/api/test-transcription', upload.single('file'), async (req, res) => {
  let convertedBuffer = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logger.info('TEST', `Testing transcription with file: ${req.file.originalname}, size: ${req.file.size}, type: ${req.file.mimetype}`);

    const axiosInstance = createAxiosInstance();

    let audioBuffer = req.file.buffer;
    let filename = 'test.mp4';
    let mimetype = 'audio/mp4';

    // Convert MP4 to WAV for testing
    if (req.file.mimetype === 'audio/mp4') {
      logger.info('TEST', 'Converting MP4 to WAV for testing...');
      try {
        convertedBuffer = await convertAudioToWav(req.file.buffer, 'mp4');
        audioBuffer = convertedBuffer;
        filename = 'test.wav';
        mimetype = 'audio/wav';
        logger.info('TEST', `Conversion successful: ${convertedBuffer.length} bytes`);
      } catch (conversionError) {
        logger.warn('TEST', `MP4 conversion failed: ${conversionError.message}`);
        // Continue with original
      }
    }

    // Create test form data
    const testFormData = new FormData();
    testFormData.append('file', audioBuffer, {
      filename: filename,
      contentType: mimetype
    });
    testFormData.append('model', 'whisper-1');
    testFormData.append('language', 'ru');

    logger.info('TEST', `Sending test request to OpenAI with ${mimetype}...`);

    const response = await axiosInstance.post('https://api.openai.com/v1/audio/transcriptions', testFormData, {
      headers: {
        ...testFormData.getHeaders(),
        'Content-Type': undefined
      },
      timeout: 30000
    });

    logger.info('TEST', 'Test successful!');
    res.json({
      success: true,
      transcription: response.data,
      fileInfo: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        converted: convertedBuffer !== null,
        finalType: mimetype
      }
    });

  } catch (error) {
    logger.error('TEST', `Test failed: ${error.message}`, {
      status: error.response?.status,
      data: error.response?.data,
      proxyUsed: useProxy,
      converted: convertedBuffer !== null
    });

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data,
      proxyUsed: useProxy,
      converted: convertedBuffer !== null
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

app.get('/api/users/by-email', async (req, res) => {
  try {
    const email = req.query.email;
    logger.debug('USER', `Getting user by email: ${email}`);

    if (!email || typeof email !== 'string') {
      console.log('[User] Invalid email parameter');
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await userService.getUserByEmail(email);
    if (user) {
      logger.user.found(user.id, email);
    } else {
      logger.user.notFound(email);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('[User] Error getting user by email:', error);
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

// Memory endpoints
app.get('/api/memory/:userId/:type', async (req, res) => {
  try {
    const { userId, type } = req.params;
    const memory = await memoryService.getMemory(userId, type);
    res.json({ memory });
  } catch (error) {
    console.error('Error getting memory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memory/:userId/:type/append', async (req, res) => {
  try {
    const { userId, type } = req.params;
    const { sessionId, userMessage, assistantMessage } = req.body;
    const updatedMemory = await memoryService.appendMemory(userId, type, sessionId, userMessage, assistantMessage);
    res.json({ memory: updatedMemory });
  } catch (error) {
    console.error('Error appending memory:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/memory/:userId/:type', async (req, res) => {
  try {
    const { userId, type } = req.params;
    await memoryService.clearMemory(userId, type);
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing memory:', error);
    res.status(500).json({ error: error.message });
  }
});

// User Profile endpoints - структурированная память психолога
app.get('/api/user-profiles/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await userProfileService.getUserProfile(userId);
    res.json({ profile });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user-profiles/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const updatedProfile = await userProfileService.updateUserProfile(userId, updates);
    res.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user-profiles/:userId/increment-session', async (req, res) => {
  try {
    const { userId } = req.params;
    const updatedProfile = await userProfileService.incrementSessionCount(userId);
    res.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Error incrementing session count:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user-profiles/:userId/add-topic', async (req, res) => {
  try {
    const { userId } = req.params;
    const { topic } = req.body;
    const updatedProfile = await userProfileService.addDiscussedTopic(userId, topic);
    res.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Error adding discussed topic:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user-profiles/:userId/emotional-state', async (req, res) => {
  try {
    const { userId } = req.params;
    const { emotionalState } = req.body;
    const updatedProfile = await userProfileService.updateEmotionalState(userId, emotionalState);
    res.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Error updating emotional state:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user-profiles/:userId/concerns', async (req, res) => {
  try {
    const { userId } = req.params;
    const { concerns } = req.body;
    const updatedProfile = await userProfileService.updateCurrentConcerns(userId, concerns);
    res.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Error updating current concerns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Payment endpoints - ЮKassa ShopAI integration
// Shop ID: 1183996, Token: live_OTmJmdMHX6ysyUcUpBz5kt-dmSq1pT-Y5gLgmpT1jXg
app.post('/api/payments/create', async (req, res) => {
  try {
    const { amount, confirmation, description, metadata, receipt } = req.body;

    logger.debug('PAYMENT', `Creating payment: ${amount} руб`, { metadata });

    const yookassaPayload = {
      amount,
      capture: true,
      confirmation,
      description: description || 'Оплата психологических услуг',
      metadata: metadata || {},
      receipt,
    };

    logger.debug('PAYMENT', 'Sending payment to YooKassa', { amount: yookassaPayload.amount });

    // Создаем платеж в ЮKassa через API
    const yookassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': `${Date.now()}-${Math.random()}`,
        'Authorization': `Basic ${Buffer.from(`1183996:live_OTmJmdMHX6ysyUcUpBz5kt-dmSq1pT-Y5gLgmpT1jXg`).toString('base64')}`,
      },
      body: JSON.stringify(yookassaPayload),
    });

    logger.debug('PAYMENT', `YooKassa response status: ${yookassaResponse.status}`);

    if (!yookassaResponse.ok) {
      const error = await yookassaResponse.text();
      logger.payment.error('creation', error);
      throw new Error(`Ошибка при создании платежа: ${error}`);
    }

    const paymentData = await yookassaResponse.json();
    logger.payment.created(paymentData.id, paymentData.amount?.value, metadata?.userId);

    res.json({
      id: paymentData.id,
      status: paymentData.status,
      confirmation: paymentData.confirmation,
    });

  } catch (error) {
    logger.payment.error('creation', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for Yookassa payment notifications
app.post('/api/payments/webhook', async (req, res) => {
  try {
    const notification = req.body;
    logger.debug('WEBHOOK', 'Received notification from YooKassa', { event: notification.event, paymentId: notification.object?.id });

    // Verify notification is from Yookassa
    if (notification.event === 'payment.succeeded') {
      const payment = notification.object;
      logger.payment.succeeded(payment.id, payment.metadata?.userId);
      logger.debug('WEBHOOK', `Payment metadata for ${payment.id}`, payment.metadata);

      if (payment.metadata?.userId && payment.metadata?.plan) {
        logger.debug('WEBHOOK', `Creating subscription for user ${payment.metadata.userId}, plan ${payment.metadata.plan}`);
        const subscriptionId = await subscriptionService.createSubscription(
          payment.metadata.userId,
          payment.metadata.plan,
          payment.id
        );
        logger.subscription.created(payment.metadata.userId, payment.metadata.plan, subscriptionId);
      } else {
        logger.warn('WEBHOOK', `Missing metadata in payment ${payment.id}`, {
          userId: payment.metadata?.userId,
          plan: payment.metadata?.plan
        });
      }
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });

  } catch (error) {
    logger.error('WEBHOOK', 'Error processing webhook', { error: error.message });
    // Still return 200 to avoid retries
    res.status(200).json({ success: false, error: error.message });
  }
});

app.get('/api/payments/verify/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    logger.debug('PAYMENT', `Verifying payment: ${paymentId}`);

    // Проверяем статус платежа в ЮKassa
    const yookassaResponse = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`1183996:live_OTmJmdMHX6ysyUcUpBz5kt-dmSq1pT-Y5gLgmpT1jXg`).toString('base64')}`,
      },
    });

    if (!yookassaResponse.ok) {
      logger.payment.error('verification', new Error(`YooKassa API error: ${yookassaResponse.status}`));
      throw new Error('Ошибка при проверке платежа');
    }

    const paymentData = await yookassaResponse.json();
    logger.debug('PAYMENT', `Payment status: ${paymentData.status}, amount: ${paymentData.amount?.value}`, paymentData.metadata);

    // Создаем подписку при успешной оплате
    if (paymentData.status === 'succeeded' && paymentData.metadata?.userId) {
      logger.debug('PAYMENT', `Payment succeeded for user ${paymentData.metadata.userId}, checking subscription`);

      // Проверяем, не обрабатывали ли мы уже этот платеж
      const existingSubscription = await subscriptionService.getUserSubscription(paymentData.metadata.userId);
      logger.debug('PAYMENT', `Current subscription for user ${paymentData.metadata.userId}`, existingSubscription);

      const subscriptionId = await subscriptionService.createSubscription(
        paymentData.metadata.userId,
        paymentData.metadata.plan,
        paymentId
      );
      logger.subscription.created(paymentData.metadata.userId, paymentData.metadata.plan, subscriptionId);

      // Проверяем результат обновления
      const updatedSubscription = await subscriptionService.getUserSubscription(paymentData.metadata.userId);
      logger.debug('PAYMENT', `Updated subscription for user ${paymentData.metadata.userId}`, updatedSubscription);
    } else {
      logger.debug('PAYMENT', `Skipping subscription creation`, {
        status: paymentData.status,
        userId: paymentData.metadata?.userId,
        plan: paymentData.metadata?.plan
      });
    }

    res.json(paymentData);

  } catch (error) {
    logger.payment.error('verification', error);
    res.status(500).json({ error: error.message });
  }
});

// Access control endpoints
app.get('/api/users/:userId/audio-access', async (req, res) => {
  try {
    const { userId } = req.params;
    const access = await accessService.checkAudioSessionAccess(userId);
    res.json(access);
  } catch (error) {
    console.error('Error checking audio access:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId/meditation-access', async (req, res) => {
  try {
    const { userId } = req.params;
    const access = await accessService.checkMeditationAccess(userId);
    res.json(access);
  } catch (error) {
    console.error('Error checking meditation access:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/:userId/use-audio-session', async (req, res) => {
  try {
    const { userId } = req.params;
    const success = await accessService.useAudioSession(userId);
    res.json({ success });
  } catch (error) {
    console.error('Error using audio session:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users/:userId/create-free-trial', async (req, res) => {
  try {
    const { userId } = req.params;
    const subscriptionId = await subscriptionService.createFreeTrialForNewUser(userId);

    if (subscriptionId) {
      res.json({ success: true, subscriptionId });
    } else {
      res.json({ success: false, reason: 'already_has_subscription' });
    }
  } catch (error) {
    console.error('Error creating free trial:', error);
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Psycholog API Server',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      openai: {
        chat: 'POST /api/chat/completions',
        transcription: 'POST /api/audio/transcriptions',
        speech: 'POST /api/audio/speech',
        models: 'GET /api/models'
      },
      users: 'GET /api/users/:userId',
      chat: 'POST /api/chat/sessions',
      audioCalls: 'POST /api/audio-calls',
      meditations: 'POST /api/meditations',
      quotes: 'GET /api/quotes',
      subscriptions: 'POST /api/subscriptions'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Initialize database before starting server
initializeDatabase().then(() => {
  if (USE_HTTPS) {
    // Start HTTPS server
    const httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
    };

    https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
      logger.server.started(PORT, 'HTTPS');
      if (useProxy) {
        logger.info('SERVER', `Proxy enabled: ${proxyConfig.host}:${proxyConfig.port}`);
      }
    });
  } else {
    // Start HTTP server
    app.listen(PORT, '0.0.0.0', () => {
      logger.server.started(PORT, 'HTTP');
      if (useProxy) {
        logger.info('SERVER', `Proxy enabled: ${proxyConfig.host}:${proxyConfig.port}`);
      }
    });
  }
}).catch((error) => {
  logger.error('DB', 'Ошибка initialization', error);
  logger.error('SERVER', 'Ошибка сервера', error);
  console.error('Database initialization error details:', error);
  process.exit(1);
});


