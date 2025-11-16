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

    return await this.createUser(email, name);
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
    const expiresAt = plan === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined;

    await db.insert(schema.subscriptions).values({
      id: subscriptionId,
      userId,
      plan,
      status: 'active',
      yookassaPaymentId,
      startedAt: toTimestamp(now),
      expiresAt: expiresAt ? toTimestamp(expiresAt) : undefined,
      autoRenew: 1,
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
      audioSessionsLimit: plan === 'premium' ? 4 : 0,
      audioSessionsUsed: 0,
      lastAudioResetAt: toTimestamp(now),
    });

    return {
      id: subscriptionId,
      userId,
      plan,
      status: 'active',
      yookassaPaymentId,
      startedAt: now,
      expiresAt,
      autoRenew: true,
      createdAt: now,
      updatedAt: now,
      audioSessionsLimit: plan === 'premium' ? 4 : 0,
      audioSessionsUsed: 0,
      lastAudioResetAt: now,
    };
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

// Memory service for conversation context
const buildMemoryKey = (userId, type) => `${type}_${userId}`;

const memoryService = {
  async getMemory(userId, type) {
    // For now, we'll use a simple in-memory approach for conversation memory
    // In production, this could be stored in a separate table or Redis
    const key = buildMemoryKey(userId, type);

    // Since we don't have a dedicated memory table, we'll store this in a simple way
    // For now, return empty string - memory will be built from chat messages
    return '';
  },

  async setMemory(userId, type, content) {
    // For now, this is a no-op since we're not storing persistent memory
    // Memory is derived from chat messages instead
    return content;
  },

  async appendMemory(userId, type, entry, maxLength = 2000) {
    // For now, this is a no-op since we're not storing persistent memory
    // Memory is derived from chat messages instead
    return entry;
  },

  async clearMemory(userId, type) {
    // For now, this is a no-op since we're not storing persistent memory
    // Memory is derived from chat messages instead
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
  db,
  schema,
  sqlite,
};
