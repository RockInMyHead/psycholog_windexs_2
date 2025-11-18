// Server-side database service wrapper
// This wraps the client-side database functions for server use

const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { eq, and, desc, sql } = require('drizzle-orm');

// Define schema inline for server use
const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');

const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  avatar: text('avatar'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title'),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  role: text('role').notNull(),
  timestamp: integer('timestamp').notNull(),
});

const audioCalls = sqliteTable('audio_calls', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  duration: integer('duration').notNull(),
  status: text('status').notNull().default('completed'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
});

const meditationSessions = sqliteTable('meditation_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  meditationTitle: text('meditation_title').notNull(),
  duration: integer('duration').notNull(),
  completedAt: integer('completed_at').notNull(),
  rating: integer('rating'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
});

const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  author: text('author').notNull(),
  category: text('category').notNull(),
  createdAt: integer('created_at').notNull(),
});

const quoteViews = sqliteTable('quote_views', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  quoteId: text('quote_id').notNull(),
  viewedAt: integer('viewed_at').notNull(),
  liked: integer('liked').notNull().default(0),
});

const userStats = sqliteTable('user_stats', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  totalChatSessions: integer('total_chat_sessions').notNull().default(0),
  totalAudioCalls: integer('total_audio_calls').notNull().default(0),
  totalMeditationMinutes: integer('total_meditation_minutes').notNull().default(0),
  totalQuotesViewed: integer('total_quotes_viewed').notNull().default(0),
  lastActivity: integer('last_activity'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  plan: text('plan').notNull(),
  status: text('status').notNull().default('active'),
  yookassaPaymentId: text('yookassa_payment_id'),
  startedAt: integer('started_at').notNull(),
  expiresAt: integer('expires_at'),
  autoRenew: integer('auto_renew').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  audioSessionsLimit: integer('audio_sessions_limit'),
  audioSessionsUsed: integer('audio_sessions_used').default(0),
  lastAudioResetAt: integer('last_audio_reset_at'),
});

// Таблица для хранения истории диалогов (контекст для психолога)
const conversationHistory = sqliteTable('conversation_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id'), // ID сессии чата или аудио звонка
  sessionType: text('session_type').notNull(), // 'chat' или 'audio'
  userMessage: text('user_message').notNull(),
  assistantMessage: text('assistant_message').notNull(),
  timestamp: integer('timestamp').notNull(),
  createdAt: integer('created_at').notNull(),
});

const schema = {
  users,
  chatSessions,
  chatMessages,
  audioCalls,
  meditationSessions,
  quotes,
  quoteViews,
  userStats,
  subscriptions,
  conversationHistory,
};

// Create database connection
const sqlite = new Database('../zen-mind-mate.db', { verbose: console.log });

// Create drizzle instance
const db = drizzle(sqlite, { schema });

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Utility functions
function toDate(value) {
  return value ? new Date(value) : undefined;
}

function toDateRequired(value) {
  return new Date(value);
}

function toTimestamp(value) {
  return value.getTime();
}

// User service
const userService = {
  async getUserById(id) {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (result.length === 0) return undefined;

    const user = result[0];
    return {
      ...user,
      createdAt: toDateRequired(user.createdAt),
      updatedAt: toDateRequired(user.updatedAt),
    };
  },

  async getUserByEmail(email) {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (result.length === 0) return undefined;

    const user = result[0];
    return {
      ...user,
      createdAt: toDateRequired(user.createdAt),
      updatedAt: toDateRequired(user.updatedAt),
    };
  },

  async createUser(email, name) {
    const now = new Date();
    const userId = `user_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

    await db.insert(schema.users).values({
      id: userId,
      name,
      email,
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
    });

    // Create default premium subscription
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(schema.subscriptions).values({
      id: `sub_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
      userId,
      plan: 'premium',
      status: 'active',
      startedAt: toTimestamp(now),
      expiresAt: toTimestamp(expiresAt),
      autoRenew: 1,
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
      audioSessionsLimit: 4,
      audioSessionsUsed: 0,
      lastAudioResetAt: toTimestamp(now),
    });

    return {
      id: userId,
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateUser(id, data) {
    const existing = await this.getUserById(id);
    if (!existing) return undefined;

    const updateData = { ...data };
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = toTimestamp(new Date());
      await db.update(schema.users).set(updateData).where(eq(schema.users.id, id));
    }

    return await this.getUserById(id);
  },

  async getOrCreateUser(email, name) {
    let user = await this.getUserByEmail(email);
    if (user) return user;

    // Создаем пользователя
    user = await this.createUser(email, name);

    // Создаем бесплатную подписку для нового пользователя
    try {
      const subscriptionId = await subscriptionService.createFreeTrialForNewUser(user.id);
      if (subscriptionId) {
        console.log('Free trial subscription created for new user:', user.id);
      }
    } catch (error) {
      console.error('Error creating free trial for new user:', error);
    }

    return user;
  },
};

// Chat service
const chatService = {
  async createChatSession(userId, title) {
    const now = new Date();
    const sessionId = `chat_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

    await db.insert(schema.chatSessions).values({
      id: sessionId,
      userId,
      title,
      startedAt: toTimestamp(now),
      createdAt: toTimestamp(now),
      messageCount: 0,
    });

    return {
      id: sessionId,
      userId,
      title,
      startedAt: now,
      createdAt: now,
      messageCount: 0,
    };
  },

  async endChatSession(sessionId) {
    const existing = await db.select().from(schema.chatSessions).where(eq(schema.chatSessions.id, sessionId));
    if (existing.length === 0) return undefined;

    const now = new Date();
    await db.update(schema.chatSessions)
      .set({ endedAt: toTimestamp(now) })
      .where(eq(schema.chatSessions.id, sessionId));

    return await this.getChatSessionById(sessionId);
  },

  async getChatSessionById(sessionId) {
    const result = await db.select().from(schema.chatSessions).where(eq(schema.chatSessions.id, sessionId));
    if (result.length === 0) return undefined;

    const session = result[0];
    return {
      ...session,
      startedAt: toDateRequired(session.startedAt),
      endedAt: toDate(session.endedAt),
      createdAt: toDateRequired(session.createdAt),
    };
  },

  async addChatMessage(sessionId, userId, content, role) {
    const messageId = `msg_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();

    await db.insert(schema.chatMessages).values({
      id: messageId,
      sessionId,
      userId,
      content,
      role,
      timestamp: toTimestamp(now),
    });

    // Update message count in session
    await db.update(schema.chatSessions)
      .set({ messageCount: sql`${schema.chatSessions.messageCount} + 1` })
      .where(eq(schema.chatSessions.id, sessionId));

    return {
      id: messageId,
      sessionId,
      userId,
      content,
      role,
      timestamp: now,
    };
  },

  async getChatMessages(sessionId) {
    const result = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.sessionId, sessionId)).orderBy(schema.chatMessages.timestamp);

    return result.map(msg => ({
      ...msg,
      timestamp: toDateRequired(msg.timestamp),
    }));
  },

  async getUserChatSessions(userId, limit = 10) {
    const result = await db.select()
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.userId, userId))
      .orderBy(desc(schema.chatSessions.createdAt))
      .limit(limit);

    return result.map(session => ({
      ...session,
      startedAt: toDateRequired(session.startedAt),
      endedAt: toDate(session.endedAt),
      createdAt: toDateRequired(session.createdAt),
    }));
  },
};

// Audio call service
const audioCallService = {
  async createAudioCall(userId) {
    const callId = `call_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();

    await db.insert(schema.audioCalls).values({
      id: callId,
      userId,
      startedAt: toTimestamp(now),
      createdAt: toTimestamp(now),
      duration: 0,
      status: 'completed',
    });

    return {
      id: callId,
      userId,
      startedAt: now,
      createdAt: now,
      duration: 0,
      status: 'completed',
    };
  },

  async endAudioCall(callId, duration) {
    const existing = await db.select().from(schema.audioCalls).where(eq(schema.audioCalls.id, callId));
    if (existing.length === 0) return undefined;

    const now = new Date();
    await db.update(schema.audioCalls)
      .set({
        endedAt: toTimestamp(now),
        duration,
      })
      .where(eq(schema.audioCalls.id, callId));

    return await this.getAudioCallById(callId);
  },

  async getAudioCallById(callId) {
    const result = await db.select().from(schema.audioCalls).where(eq(schema.audioCalls.id, callId));
    if (result.length === 0) return undefined;

    const call = result[0];
    return {
      ...call,
      startedAt: toDateRequired(call.startedAt),
      endedAt: toDate(call.endedAt),
      createdAt: toDateRequired(call.createdAt),
    };
  },

  async getUserAudioCalls(userId, limit = 10) {
    const result = await db.select()
      .from(schema.audioCalls)
      .where(eq(schema.audioCalls.userId, userId))
      .orderBy(desc(schema.audioCalls.createdAt))
      .limit(limit);

    return result.map(call => ({
      ...call,
      startedAt: toDateRequired(call.startedAt),
      endedAt: toDate(call.endedAt),
      createdAt: toDateRequired(call.createdAt),
    }));
  },
};

// Meditation service
const meditationService = {
  async createMeditationSession(userId, meditationTitle, duration, rating, notes) {
    const sessionId = `med_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();

    await db.insert(schema.meditationSessions).values({
      id: sessionId,
      userId,
      meditationTitle,
      duration,
      completedAt: toTimestamp(now),
      rating,
      notes,
      createdAt: toTimestamp(now),
    });

    return {
      id: sessionId,
      userId,
      meditationTitle,
      duration,
      completedAt: now,
      rating,
      notes,
      createdAt: now,
    };
  },

  async getUserMeditationSessions(userId, limit = 20) {
    const result = await db.select()
      .from(schema.meditationSessions)
      .where(eq(schema.meditationSessions.userId, userId))
      .orderBy(desc(schema.meditationSessions.completedAt))
      .limit(limit);

    return result.map(session => ({
      ...session,
      completedAt: toDateRequired(session.completedAt),
      createdAt: toDateRequired(session.createdAt),
    }));
  },

  async getUserMeditationStats(userId) {
    const sessions = await this.getUserMeditationSessions(userId, 1000); // Get all for stats

    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((acc, session) => acc + session.duration, 0);
    const ratings = sessions
      .map((session) => session.rating)
      .filter((rating) => rating !== undefined);

    const avgRating = ratings.length > 0 ? ratings.reduce((acc, rating) => acc + rating, 0) / ratings.length : 0;

    return {
      totalSessions,
      totalMinutes,
      avgRating,
    };
  },
};

// Quote service
const quoteService = {
  async getAllQuotes() {
    const result = await db.select().from(schema.quotes).orderBy(schema.quotes.createdAt);

    return result.map(quote => ({
      ...quote,
      createdAt: toDateRequired(quote.createdAt),
    }));
  },

  async viewQuote(userId, quoteId, liked = false) {
    const viewId = `view_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();

    await db.insert(schema.quoteViews).values({
      id: viewId,
      userId,
      quoteId,
      viewedAt: toTimestamp(now),
      liked: liked ? 1 : 0,
    });

    return {
      id: viewId,
      userId,
      quoteId,
      viewedAt: now,
      liked,
    };
  },

  async toggleQuoteLike(userId, quoteId) {
    const existing = await db
      .select()
      .from(schema.quoteViews)
      .where(and(eq(schema.quoteViews.userId, userId), eq(schema.quoteViews.quoteId, quoteId)))
      .orderBy(desc(schema.quoteViews.viewedAt))
      .limit(1);

    if (existing.length > 0) {
      const view = existing[0];
      const newLiked = !view.liked;
      const now = new Date();

      await db.update(schema.quoteViews)
        .set({
          liked: newLiked,
          viewedAt: toTimestamp(now),
        })
        .where(eq(schema.quoteViews.id, view.id));

      return {
        ...view,
        liked: newLiked,
        viewedAt: now,
      };
    } else {
      return await this.viewQuote(userId, quoteId, true);
    }
  },

  async getUserQuoteViews(userId, limit = 20) {
    const result = await db
      .select({
        view: schema.quoteViews,
        quote: schema.quotes,
      })
      .from(schema.quoteViews)
      .innerJoin(schema.quotes, eq(schema.quoteViews.quoteId, schema.quotes.id))
      .where(eq(schema.quoteViews.userId, userId))
      .orderBy(desc(schema.quoteViews.viewedAt))
      .limit(limit);

    return result.map(row => ({
      view: {
        ...row.view,
        viewedAt: toDateRequired(row.view.viewedAt),
      },
      quote: {
        ...row.quote,
        createdAt: toDateRequired(row.quote.createdAt),
      },
    }));
  },

  async getUserQuoteStats(userId) {
    const result = await db.run(`
      SELECT
        COUNT(*) as totalViewed,
        COUNT(CASE WHEN liked = 1 THEN 1 END) as totalLiked
      FROM quote_views
      WHERE user_id = ?
    `, [userId]);

    return {
      totalViewed: result[0].totalViewed,
      totalLiked: result[0].totalLiked,
    };
  },

  async getUserLikedQuotes(userId, limit = 50) {
    const result = await db
      .select({
        view: schema.quoteViews,
        quote: schema.quotes,
      })
      .from(schema.quoteViews)
      .innerJoin(schema.quotes, eq(schema.quoteViews.quoteId, schema.quotes.id))
      .where(and(eq(schema.quoteViews.userId, userId), eq(schema.quoteViews.liked, 1)))
      .orderBy(desc(schema.quoteViews.viewedAt))
      .limit(limit);

    return result.map(row => ({
      view: {
        ...row.view,
        viewedAt: toDateRequired(row.view.viewedAt),
      },
      quote: {
        ...row.quote,
        createdAt: toDateRequired(row.quote.createdAt),
      },
    }));
  },
};

// User stats service
const userStatsService = {
  async updateUserStats(userId) {
    const chatSessions = await db.run('SELECT COUNT(*) as count FROM chat_sessions WHERE user_id = ?', [userId]);
    const audioCalls = await db.run('SELECT COUNT(*) as count FROM audio_calls WHERE user_id = ?', [userId]);
    const meditationStats = await meditationService.getUserMeditationStats(userId);
    const quoteStats = await quoteService.getUserQuoteStats(userId);

    const now = new Date();

    await db.run(`
      INSERT OR REPLACE INTO user_stats
      (id, user_id, total_chat_sessions, total_audio_calls, total_meditation_minutes, total_quotes_viewed, last_activity, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `stats_${userId}`,
      userId,
      chatSessions[0].count,
      audioCalls[0].count,
      meditationStats.totalMinutes,
      quoteStats.totalViewed,
      toTimestamp(now),
      toTimestamp(now),
      toTimestamp(now),
    ]);
  },

  async getUserStats(userId) {
    let result = await db.select().from(schema.userStats).where(eq(schema.userStats.userId, userId));

    if (result.length === 0) {
      await this.updateUserStats(userId);
      result = await db.select().from(schema.userStats).where(eq(schema.userStats.userId, userId));
    }

    const stats = result[0];
    return {
      ...stats,
      createdAt: toDateRequired(stats.createdAt),
      updatedAt: toDateRequired(stats.updatedAt),
      lastActivity: toDate(stats.lastActivity),
    };
  },
};

// Subscription service
const subscriptionService = {
  async getUserSubscription(userId) {
    const result = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt))
      .limit(1);

    if (result.length === 0) return undefined;

    const subscription = result[0];
    return {
      ...subscription,
      startedAt: toDateRequired(subscription.startedAt),
      expiresAt: toDate(subscription.expiresAt),
      createdAt: toDateRequired(subscription.createdAt),
      updatedAt: toDateRequired(subscription.updatedAt),
      lastAudioResetAt: toDate(subscription.lastAudioResetAt),
    };
  },

  async createSubscription(userId, plan, yookassaPaymentId) {
    const subscriptionId = `sub_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();

    // Определяем параметры подписки в зависимости от плана
    let subscriptionData = {
      audioSessionsLimit: 0,
      meditationAccess: 0,
      freeSessionsRemaining: 0,
      expiresAt: undefined,
      status: 'active',
    };

    switch (plan) {
      case 'single_session':
        subscriptionData.audioSessionsLimit = 1;
        subscriptionData.status = 'active'; // Доступен сразу после оплаты
        break;
      case 'four_sessions':
        subscriptionData.audioSessionsLimit = 4;
        subscriptionData.status = 'active'; // Доступен сразу после оплаты
        break;
      case 'meditation_monthly':
        subscriptionData.meditationAccess = 1;
        subscriptionData.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 дней
        break;
      case 'free_trial':
        // Бесплатные сессии для новых пользователей
        subscriptionData.freeSessionsRemaining = 3;
        subscriptionData.audioSessionsLimit = 3;
        subscriptionData.status = 'active';
        break;
      default:
        throw new Error(`Unknown subscription plan: ${plan}`);
    }

    await db.insert(schema.subscriptions).values({
      id: subscriptionId,
      userId,
      plan,
      status: subscriptionData.status,
      yookassaPaymentId,
      startedAt: toTimestamp(now),
      expiresAt: subscriptionData.expiresAt ? toTimestamp(subscriptionData.expiresAt) : undefined,
      autoRenew: plan === 'meditation_monthly' ? 1 : 0, // Автопродление только для месячных подписок
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
      audioSessionsLimit: subscriptionData.audioSessionsLimit,
      audioSessionsUsed: 0,
      meditationAccess: subscriptionData.meditationAccess,
      freeSessionsRemaining: subscriptionData.freeSessionsRemaining,
      lastAudioResetAt: toTimestamp(now),
    });

    return subscriptionId;
  },

  async createFreeTrialForNewUser(userId) {
    // Проверяем, есть ли уже подписка у пользователя
    const existingSubscriptions = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    if (existingSubscriptions.length > 0) {
      return null; // У пользователя уже есть подписка
    }

    // Создаем бесплатную подписку
    return await this.createSubscription(userId, 'free_trial', null);
  },

  async updateSubscriptionStatus(subscriptionId, status) {
    const existing = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subscriptionId));
    if (existing.length === 0) return undefined;

    const now = new Date();
    await db.update(schema.subscriptions)
      .set({
        status,
        updatedAt: toTimestamp(now),
      })
      .where(eq(schema.subscriptions.id, subscriptionId));

    return await this.getSubscriptionById(subscriptionId);
  },

  async getSubscriptionById(subscriptionId) {
    const result = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subscriptionId));
    if (result.length === 0) return undefined;

    const subscription = result[0];
    return {
      ...subscription,
      startedAt: toDateRequired(subscription.startedAt),
      expiresAt: toDate(subscription.expiresAt),
      createdAt: toDateRequired(subscription.createdAt),
      updatedAt: toDateRequired(subscription.updatedAt),
      lastAudioResetAt: toDate(subscription.lastAudioResetAt),
    };
  },

  async cancelSubscription(subscriptionId) {
    return await this.updateSubscriptionStatus(subscriptionId, 'cancelled');
  },

  async getUserSubscriptions(userId) {
    const result = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt));

    return result.map(subscription => ({
      ...subscription,
      startedAt: toDateRequired(subscription.startedAt),
      expiresAt: toDate(subscription.expiresAt),
      createdAt: toDateRequired(subscription.createdAt),
      updatedAt: toDateRequired(subscription.updatedAt),
      lastAudioResetAt: toDate(subscription.lastAudioResetAt),
    }));
  },

  async getAudioSessionInfo(userId) {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      return {
        plan: 'none',
        remaining: 0,
        limit: 0,
        status: 'none',
      };
    }

    const limit = subscription.audioSessionsLimit || (subscription.plan === 'premium' ? 4 : 0);
    const used = subscription.audioSessionsUsed || 0;
    const remaining = Math.max(0, limit - used);

    return {
      plan: subscription.plan,
      remaining,
      limit,
      status: subscription.status,
    };
  },

  async recordAudioSession(userId) {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription || subscription.plan !== 'premium' || subscription.status !== 'active') {
      return { success: false, remaining: 0, limit: 0, message: 'Нет активной премиум подписки' };
    }

    const limit = subscription.audioSessionsLimit || 4;
    const used = subscription.audioSessionsUsed || 0;

    if (used >= limit) {
      return { success: false, remaining: 0, limit, message: 'Лимит аудио сессий исчерпан' };
    }

    const now = new Date();
    await db.update(schema.subscriptions)
      .set({
        audioSessionsUsed: used + 1,
        updatedAt: toTimestamp(now),
      })
      .where(eq(schema.subscriptions.id, subscription.id));

    return {
      success: true,
      remaining: Math.max(0, limit - (used + 1)),
      limit,
    };
  },
};

// Conversation History Service - для сохранения контекста психолога
const conversationHistoryService = {
  async addConversationEntry(userId, sessionId, sessionType, userMessage, assistantMessage) {
    const entryId = `hist_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    const now = new Date();

    await db.insert(schema.conversationHistory).values({
      id: entryId,
      userId,
      sessionId,
      sessionType,
      userMessage,
      assistantMessage,
      timestamp: toTimestamp(now),
      createdAt: toTimestamp(now),
    });

    return entryId;
  },

  async getConversationHistory(userId, sessionType, limit = 20) {
    const result = await db
      .select()
      .from(schema.conversationHistory)
      .where(
        and(
          eq(schema.conversationHistory.userId, userId),
          eq(schema.conversationHistory.sessionType, sessionType)
        )
      )
      .orderBy(desc(schema.conversationHistory.timestamp))
      .limit(limit);

    return result.reverse().map(entry => ({
      id: entry.id,
      userId: entry.userId,
      sessionId: entry.sessionId,
      sessionType: entry.sessionType,
      userMessage: entry.userMessage,
      assistantMessage: entry.assistantMessage,
      timestamp: toDateRequired(entry.timestamp),
      createdAt: toDateRequired(entry.createdAt),
    }));
  },

  async getFormattedHistory(userId, sessionType, limit = 10) {
    const history = await this.getConversationHistory(userId, sessionType, limit);
    
    if (history.length === 0) {
      return '';
    }

    // Форматируем историю для передачи в LLM
    return history.map(entry => 
      `Клиент: ${entry.userMessage}\nМарк: ${entry.assistantMessage}`
    ).join('\n\n');
  },

  async clearUserHistory(userId, sessionType) {
    await db
      .delete(schema.conversationHistory)
      .where(
        and(
          eq(schema.conversationHistory.userId, userId),
          eq(schema.conversationHistory.sessionType, sessionType)
        )
      );
  },
};

// Memory service for conversation context (обновленный с использованием БД)
const memoryService = {
  async getMemory(userId, type) {
    // Загружаем историю из БД
    return await conversationHistoryService.getFormattedHistory(userId, type, 10);
  },

  async setMemory(userId, type, content) {
    // Не используется, так как мы сохраняем каждую запись отдельно
    return content;
  },

  async appendMemory(userId, type, sessionId, userMessage, assistantMessage) {
    // Сохраняем новую запись в историю
    await conversationHistoryService.addConversationEntry(
      userId, 
      sessionId, 
      type, 
      userMessage, 
      assistantMessage
    );
    
    // Возвращаем обновленную историю
    return await conversationHistoryService.getFormattedHistory(userId, type, 10);
  },

  async clearMemory(userId, type) {
    await conversationHistoryService.clearUserHistory(userId, type);
  },
};

// Обновленная логика для проверки доступа к функциям
const accessService = {
  checkAudioSessionAccess: async function(userId) {
    const subscription = await subscriptionService.getUserSubscription(userId);
    if (!subscription) return { hasAccess: false, reason: 'no_subscription' };

    // Проверяем, активная ли подписка
    if (subscription.status !== 'active') {
      return { hasAccess: false, reason: 'subscription_inactive' };
    }

    // Проверяем срок действия подписки
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      return { hasAccess: false, reason: 'subscription_expired' };
    }

    // Проверяем бесплатные сессии
    if (subscription.freeSessionsRemaining > 0) {
      return { hasAccess: true, type: 'free_trial', remaining: subscription.freeSessionsRemaining };
    }

    // Проверяем платные сессии
    if (subscription.audioSessionsLimit > subscription.audioSessionsUsed) {
      return {
        hasAccess: true,
        type: 'paid',
        remaining: subscription.audioSessionsLimit - subscription.audioSessionsUsed,
        total: subscription.audioSessionsLimit
      };
    }

    return { hasAccess: false, reason: 'no_sessions_left' };
  },

  checkMeditationAccess: async function(userId) {
    const subscription = await subscriptionService.getUserSubscription(userId);
    if (!subscription) return { hasAccess: false, reason: 'no_subscription' };

    if (subscription.status !== 'active') {
      return { hasAccess: false, reason: 'subscription_inactive' };
    }

    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      return { hasAccess: false, reason: 'subscription_expired' };
    }

    if (subscription.meditationAccess === 1) {
      return { hasAccess: true, type: 'paid' };
    }

    return { hasAccess: false, reason: 'no_meditation_access' };
  },

  useAudioSession: async function(userId) {
    const subscription = await subscriptionService.getUserSubscription(userId);
    if (!subscription) return false;

    if (subscription.status !== 'active') return false;
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) return false;

    // Используем бесплатную сессию
    if (subscription.freeSessionsRemaining > 0) {
      await db.update(schema.subscriptions)
        .set({
          freeSessionsRemaining: subscription.freeSessionsRemaining - 1,
          updatedAt: toTimestamp(new Date())
        })
        .where(eq(schema.subscriptions.id, subscription.id));
      return true;
    }

    // Используем платную сессию
    if (subscription.audioSessionsLimit > subscription.audioSessionsUsed) {
      await db.update(schema.subscriptions)
        .set({
          audioSessionsUsed: subscription.audioSessionsUsed + 1,
          updatedAt: toTimestamp(new Date())
        })
        .where(eq(schema.subscriptions.id, subscription.id));
      return true;
    }

    return false;
  },
};

module.exports = {
  userService,
  chatService,
  audioCallService,
  meditationService,
  quoteService,
  userStatsService,
  subscriptionService,
  memoryService,
  conversationHistoryService,
  accessService,
  db,
  schema,
  sqlite,
};
