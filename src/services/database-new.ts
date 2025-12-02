/*
  Database service using SQLite with Drizzle ORM.
  Handles all database operations for the application.
*/

import { db } from '@/db/index';
import * as schema from '@/db/schema';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export type ID = string;

// Utility functions
function toDate(value?: string | Date): Date | undefined {
  return value ? new Date(value) : undefined;
}

function toDateRequired(value: string | Date): Date {
  return new Date(value);
}

// Type definitions matching schema
export type User = {
  id: ID;
  name: string;
  email: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatSession = {
  id: ID;
  userId: ID;
  title?: string;
  startedAt: Date;
  endedAt?: Date;
  messageCount: number;
  createdAt: Date;
};

export type ChatMessage = {
  id: ID;
  sessionId: ID;
  userId: ID;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

export type AudioCall = {
  id: ID;
  userId: ID;
  startedAt: Date;
  endedAt?: Date;
  duration: number;
  status: 'completed' | 'missed' | 'cancelled';
  notes?: string;
  createdAt: Date;
};

export type MeditationSession = {
  id: ID;
  userId: ID;
  meditationTitle: string;
  duration: number;
  completedAt: Date;
  rating?: number;
  notes?: string;
  createdAt: Date;
};

export type Quote = {
  id: ID;
  text: string;
  author: string;
  category: string;
  createdAt: Date;
};

export type QuoteView = {
  id: ID;
  userId: ID;
  quoteId: ID;
  viewedAt: Date;
  liked: boolean;
};

export type UserStat = {
  id: ID;
  userId: ID;
  totalChatSessions: number;
  totalAudioCalls: number;
  totalMeditationMinutes: number;
  totalQuotesViewed: number;
  lastActivity?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type Subscription = {
  id: ID;
  userId: ID;
  plan: 'free' | 'premium';
  status: 'active' | 'inactive' | 'cancelled';
  yookassaPaymentId?: string;
  startedAt: Date;
  expiresAt?: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
  audioSessionsLimit?: number;
  audioSessionsUsed?: number;
  lastAudioResetAt?: Date;
};

// Memory types for conversation context
type MemoryType = 'chat' | 'audio';

type ConversationMemory = {
  id: ID;
  userId: ID;
  type: MemoryType;
  content: string;
  updatedAt: Date;
};

const MAX_MEMORY_LENGTH = 2000;
const PREMIUM_AUDIO_SESSIONS_LIMIT = 4;

function ensureSubscriptionAudioUsage(subscription: { plan: string; status: string; audioSessionsLimit?: number | null }, now: Date): boolean {
  let changed = false;
  const nowIso = now.toISOString();

  if (subscription.plan === 'premium' && subscription.status === 'active') {
    if (subscription.audioSessionsLimit !== PREMIUM_AUDIO_SESSIONS_LIMIT) {
      subscription.audioSessionsLimit = PREMIUM_AUDIO_SESSIONS_LIMIT;
      changed = true;
    }

    if (typeof subscription.audioSessionsUsed !== 'number' || subscription.audioSessionsUsed < 0) {
      subscription.audioSessionsUsed = 0;
      changed = true;
    }

    const lastReset = subscription.lastAudioResetAt ? new Date(subscription.lastAudioResetAt) : undefined;
    if (!lastReset || lastReset.getUTCFullYear() !== now.getUTCFullYear() || lastReset.getUTCMonth() !== now.getUTCMonth()) {
      subscription.audioSessionsUsed = 0;
      subscription.lastAudioResetAt = nowIso;
      changed = true;
    }

    if ((subscription.audioSessionsUsed ?? 0) > (subscription.audioSessionsLimit ?? PREMIUM_AUDIO_SESSIONS_LIMIT)) {
      subscription.audioSessionsUsed = subscription.audioSessionsLimit ?? PREMIUM_AUDIO_SESSIONS_LIMIT;
      changed = true;
    }
  } else {
    if (subscription.audioSessionsLimit !== 0) {
      subscription.audioSessionsLimit = 0;
      changed = true;
    }
    if ((subscription.audioSessionsUsed ?? 0) !== 0) {
      subscription.audioSessionsUsed = 0;
      changed = true;
    }
    if (!subscription.lastAudioResetAt) {
      subscription.lastAudioResetAt = nowIso;
      changed = true;
    }
  }

  if (changed) {
    subscription.updatedAt = nowIso;
  }

  return changed;
}

// User service
export const userService = {
  async getUserById(id: ID): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    if (result.length === 0) return undefined;

    const user = result[0];
    return {
      ...user,
      createdAt: toDateRequired(user.createdAt),
      updatedAt: toDateRequired(user.updatedAt),
    };
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (result.length === 0) return undefined;

    const user = result[0];
    return {
      ...user,
      createdAt: toDateRequired(user.createdAt),
      updatedAt: toDateRequired(user.updatedAt),
    };
  },

  async createUser(email: string, name: string): Promise<User> {
    const now = new Date();
    const userId = createId();

    await db.insert(schema.users).values({
      id: userId,
      name,
      email,
      createdAt: now,
      updatedAt: now,
    });

    // Create default premium subscription
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(schema.subscriptions).values({
      id: createId(),
      userId,
      plan: 'premium',
      status: 'active',
      startedAt: now,
      expiresAt,
      autoRenew: true,
      createdAt: now,
      updatedAt: now,
      audioSessionsLimit: PREMIUM_AUDIO_SESSIONS_LIMIT,
      audioSessionsUsed: 0,
      lastAudioResetAt: now,
    });

    return {
      id: userId,
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };
  },

  async updateUser(id: ID, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const existing = await this.getUserById(id);
    if (!existing) return undefined;

    const updateData = { ...data };
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(schema.users).set(updateData).where(eq(schema.users.id, id));
    }

    return await this.getUserById(id);
  },

  async getOrCreateUser(email: string, name: string): Promise<User> {
    const user = await this.getUserByEmail(email);
    if (user) return user;

    return await this.createUser(email, name);
  },
};

// Chat service
export const chatService = {
  async createChatSession(userId: ID, title?: string): Promise<ChatSession> {
    const now = new Date();
    const sessionId = createId();

    await db.insert(schema.chatSessions).values({
      id: sessionId,
      userId,
      title,
      startedAt: now,
      createdAt: now,
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

  async endChatSession(sessionId: ID): Promise<ChatSession | undefined> {
    const existing = await db.select().from(schema.chatSessions).where(eq(schema.chatSessions.id, sessionId));
    if (existing.length === 0) return undefined;

    const now = new Date();
    await db.update(schema.chatSessions)
      .set({ endedAt: now })
      .where(eq(schema.chatSessions.id, sessionId));

    return await this.getChatSessionById(sessionId);
  },

  async getChatSessionById(sessionId: ID): Promise<ChatSession | undefined> {
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

  async addChatMessage(
    sessionId: ID,
    userId: ID,
    content: string,
    role: 'user' | 'assistant',
  ): Promise<ChatMessage | undefined> {
    const messageId = createId();
    const now = new Date();

    await db.insert(schema.chatMessages).values({
      id: messageId,
      sessionId,
      userId,
      content,
      role,
      timestamp: now,
    });

    // Update message count in session
    await db.update(schema.chatSessions)
      .set(sql`${schema.chatSessions.messageCount} = ${schema.chatSessions.messageCount} + 1`)
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

  async getChatMessages(sessionId: ID): Promise<ChatMessage[]> {
    const result = await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, sessionId))
      .orderBy(asc(schema.chatMessages.timestamp));

    return result.map(msg => ({
      ...msg,
      timestamp: toDateRequired(msg.timestamp),
    }));
  },

  async getUserChatSessions(userId: ID, limit = 10): Promise<ChatSession[]> {
    const result = await db
      .select()
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
export const audioCallService = {
  async createAudioCall(userId: ID): Promise<AudioCall> {
    const callId = createId();
    const now = new Date();

    await db.insert(schema.audioCalls).values({
      id: callId,
      userId,
      startedAt: now,
      createdAt: now,
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

  async endAudioCall(callId: ID, duration: number): Promise<AudioCall | undefined> {
    const existing = await db.select().from(schema.audioCalls).where(eq(schema.audioCalls.id, callId));
    if (existing.length === 0) return undefined;

    const now = new Date();
    await db.update(schema.audioCalls)
      .set({
        endedAt: now,
        duration,
      })
      .where(eq(schema.audioCalls.id, callId));

    return await this.getAudioCallById(callId);
  },

  async getAudioCallById(callId: ID): Promise<AudioCall | undefined> {
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

  async getUserAudioCalls(userId: ID, limit = 10): Promise<AudioCall[]> {
    const result = await db
      .select()
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
export const meditationService = {
  async createMeditationSession(
    userId: ID,
    meditationTitle: string,
    duration: number,
    rating?: number,
    notes?: string,
  ): Promise<MeditationSession> {
    const sessionId = createId();
    const now = new Date();

    await db.insert(schema.meditationSessions).values({
      id: sessionId,
      userId,
      meditationTitle,
      duration,
      completedAt: now,
      rating,
      notes,
      createdAt: now,
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

  async getUserMeditationSessions(userId: ID, limit = 20): Promise<MeditationSession[]> {
    const result = await db
      .select()
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

  async getUserMeditationStats(userId: ID): Promise<{
    totalSessions: number;
    totalMinutes: number;
    avgRating: number;
  }> {
    const sessions = await this.getUserMeditationSessions(userId, 1000); // Get all for stats

    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((acc, session) => acc + session.duration, 0);
    const ratings = sessions
      .map((session) => session.rating)
      .filter((rating): rating is number => rating !== undefined);

    const avgRating = ratings.length > 0 ? ratings.reduce((acc, rating) => acc + rating, 0) / ratings.length : 0;

    return {
      totalSessions,
      totalMinutes,
      avgRating,
    };
  },
};

// Quote service
export const quoteService = {
  async getAllQuotes(): Promise<Quote[]> {
    const result = await db
      .select()
      .from(schema.quotes)
      .orderBy(asc(schema.quotes.createdAt));

    return result.map(quote => ({
      ...quote,
      createdAt: toDateRequired(quote.createdAt),
    }));
  },

  async viewQuote(userId: ID, quoteId: ID, liked = false): Promise<QuoteView> {
    const viewId = createId();
    const now = new Date();

    await db.insert(schema.quoteViews).values({
      id: viewId,
      userId,
      quoteId,
      viewedAt: now,
      liked,
    });

    return {
      id: viewId,
      userId,
      quoteId,
      viewedAt: now,
      liked,
    };
  },

  async toggleQuoteLike(userId: ID, quoteId: ID): Promise<QuoteView> {
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
          viewedAt: now,
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

  async getUserQuoteViews(userId: ID, limit = 20): Promise<{ view: QuoteView; quote: Quote }[]> {
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

  async getUserQuoteStats(userId: ID): Promise<{ totalViewed: number; totalLiked: number }> {
    const result = await db
      .select({
        totalViewed: sql<number>`count(*)`,
        totalLiked: sql<number>`count(case when ${schema.quoteViews.liked} = 1 then 1 end)`,
      })
      .from(schema.quoteViews)
      .where(eq(schema.quoteViews.userId, userId));

    return {
      totalViewed: result[0].totalViewed,
      totalLiked: result[0].totalLiked,
    };
  },

  async getUserLikedQuotes(userId: ID, limit = 50): Promise<{ quote: Quote; view: QuoteView }[]> {
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
export const userStatsService = {
  async updateUserStats(userId: ID): Promise<void> {
    const chatSessions = await db.select({ count: sql<number>`count(*)` })
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.userId, userId));

    const audioCalls = await db.select({ count: sql<number>`count(*)` })
      .from(schema.audioCalls)
      .where(eq(schema.audioCalls.userId, userId));

    const meditationStats = await meditationService.getUserMeditationStats(userId);
    const quoteStats = await quoteService.getUserQuoteStats(userId);

    const now = new Date();

    await db.insert(schema.userStats).values({
      id: createId(),
      userId,
      totalChatSessions: chatSessions[0].count,
      totalAudioCalls: audioCalls[0].count,
      totalMeditationMinutes: meditationStats.totalMinutes,
      totalQuotesViewed: quoteStats.totalViewed,
      lastActivity: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: schema.userStats.userId,
      set: {
        totalChatSessions: chatSessions[0].count,
        totalAudioCalls: audioCalls[0].count,
        totalMeditationMinutes: meditationStats.totalMinutes,
        totalQuotesViewed: quoteStats.totalViewed,
        lastActivity: now,
        updatedAt: now,
      },
    });
  },

  async getUserStats(userId: ID): Promise<UserStat> {
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
export const subscriptionService = {
  async getUserSubscription(userId: ID): Promise<Subscription | undefined> {
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

  async createSubscription(
    userId: ID,
    plan: 'free' | 'premium',
    yookassaPaymentId?: string
  ): Promise<Subscription> {
    const subscriptionId = createId();
    const now = new Date();
    const expiresAt = plan === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined;

    await db.insert(schema.subscriptions).values({
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
      audioSessionsLimit: plan === 'premium' ? PREMIUM_AUDIO_SESSIONS_LIMIT : 0,
      audioSessionsUsed: 0,
      lastAudioResetAt: now,
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
      audioSessionsLimit: plan === 'premium' ? PREMIUM_AUDIO_SESSIONS_LIMIT : 0,
      audioSessionsUsed: 0,
      lastAudioResetAt: now,
    };
  },

  async updateSubscriptionStatus(
    subscriptionId: ID,
    status: 'active' | 'inactive' | 'cancelled'
  ): Promise<Subscription | undefined> {
    const existing = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.id, subscriptionId));
    if (existing.length === 0) return undefined;

    const now = new Date();
    await db.update(schema.subscriptions)
      .set({
        status,
        updatedAt: now,
      })
      .where(eq(schema.subscriptions.id, subscriptionId));

    return await this.getSubscriptionById(subscriptionId);
  },

  async getSubscriptionById(subscriptionId: ID): Promise<Subscription | undefined> {
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

  async cancelSubscription(subscriptionId: ID): Promise<Subscription | undefined> {
    return await this.updateSubscriptionStatus(subscriptionId, 'cancelled');
  },

  async getUserSubscriptions(userId: ID): Promise<Subscription[]> {
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

  async getAudioSessionInfo(userId: ID): Promise<{ plan: 'premium' | 'free' | 'none'; remaining: number; limit: number; status: 'active' | 'inactive' | 'cancelled' | 'none' }> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      return {
        plan: 'none',
        remaining: 0,
        limit: 0,
        status: 'none',
      };
    }

    const limit = subscription.audioSessionsLimit ?? (subscription.plan === 'premium' ? PREMIUM_AUDIO_SESSIONS_LIMIT : 0);
    const used = subscription.audioSessionsUsed ?? 0;
    const remaining = Math.max(0, limit - used);

    return {
      plan: subscription.plan,
      remaining,
      limit,
      status: subscription.status,
    };
  },

  async recordAudioSession(userId: ID): Promise<{ success: boolean; remaining: number; limit: number; message?: string }> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription || subscription.plan !== 'premium' || subscription.status !== 'active') {
      return { success: false, remaining: 0, limit: 0, message: 'Нет активной премиум подписки' };
    }

    const limit = subscription.audioSessionsLimit ?? PREMIUM_AUDIO_SESSIONS_LIMIT;
    const used = subscription.audioSessionsUsed ?? 0;

    if (used >= limit) {
      return { success: false, remaining: 0, limit, message: 'Лимит аудио сессий исчерпан' };
    }

    const now = new Date();
    await db.update(schema.subscriptions)
      .set({
        audioSessionsUsed: used + 1,
        updatedAt: now,
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
const buildMemoryKey = (userId: ID, type: MemoryType) => `${type}_${userId}`;

export const memoryService = {
  async getMemory(userId: ID, type: MemoryType): Promise<string> {
    // For now, we'll use a simple in-memory approach for conversation memory
    // In production, this could be stored in a separate table or Redis
    const key = buildMemoryKey(userId, type);

    // Since we don't have a dedicated memory table, we'll store this in a simple way
    // For now, return empty string - memory will be built from chat messages
    return '';
  },

  async setMemory(userId: ID, type: MemoryType, content: string): Promise<string> {
    // For now, this is a no-op since we're not storing persistent memory
    // Memory is derived from chat messages instead
    return content;
  },

  async appendMemory(userId: ID, type: MemoryType, entry: string, maxLength = MAX_MEMORY_LENGTH): Promise<string> {
    // For now, this is a no-op since we're not storing persistent memory
    // Memory is derived from chat messages instead
    return entry;
  },

  async clearMemory(userId: ID, type: MemoryType): Promise<void> {
    // For now, this is a no-op since we're not storing persistent memory
    // Memory is derived from chat messages instead
  },
};
