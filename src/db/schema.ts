import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  avatar: text('avatar'),
  passwordHash: text('password_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Chat Sessions table
export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title'),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  messageCount: integer('message_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

// Chat Messages table
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sessionId: text('session_id').notNull().references(() => chatSessions.id),
  userId: text('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  role: text('role').notNull(), // 'user' or 'assistant'
  timestamp: integer('timestamp').notNull(),
});

// Audio Calls table
export const audioCalls = sqliteTable('audio_calls', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
  duration: integer('duration').notNull(), // in seconds
  status: text('status').notNull().default('completed'), // 'completed', 'missed', 'cancelled'
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
});

// Meditation Sessions table
export const meditationSessions = sqliteTable('meditation_sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id),
  meditationTitle: text('meditation_title').notNull(),
  duration: integer('duration').notNull(), // in minutes
  completedAt: integer('completed_at').notNull(),
  rating: integer('rating'), // 1-5 stars
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
});

// Quotes table
export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  text: text('text').notNull(),
  author: text('author').notNull(),
  category: text('category').notNull(),
  createdAt: integer('created_at').notNull(),
});

// Quote Views table
export const quoteViews = sqliteTable('quote_views', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id),
  quoteId: text('quote_id').notNull().references(() => quotes.id),
  viewedAt: integer('viewed_at').notNull(),
  liked: integer('liked').notNull().default(0), // 0 or 1
});

// User Statistics table
export const userStats = sqliteTable('user_stats', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id).unique(),
  totalChatSessions: integer('total_chat_sessions').notNull().default(0),
  totalAudioCalls: integer('total_audio_calls').notNull().default(0),
  totalMeditationMinutes: integer('total_meditation_minutes').notNull().default(0),
  totalQuotesViewed: integer('total_quotes_viewed').notNull().default(0),
  lastActivity: integer('last_activity'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Subscriptions table
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id),
  plan: text('plan').notNull(), // 'free', 'single_session', 'four_sessions', 'meditation_monthly'
  status: text('status').notNull().default('active'), // 'active', 'inactive', 'cancelled', 'used'
  yookassaPaymentId: text('yookassa_payment_id'),
  startedAt: integer('started_at').notNull(),
  expiresAt: integer('expires_at'), // For monthly subscriptions
  autoRenew: integer('auto_renew').notNull().default(1), // 0 or 1
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  // Audio sessions (for single_session and four_sessions plans)
  audioSessionsLimit: integer('audio_sessions_limit'),
  audioSessionsUsed: integer('audio_sessions_used').default(0),
  // Meditation access (for meditation_monthly plan)
  meditationAccess: integer('meditation_access').default(0), // 0 or 1
  // Free sessions for new users
  freeSessionsRemaining: integer('free_sessions_remaining').default(0),
});

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

export type AudioCall = typeof audioCalls.$inferSelect;
export type NewAudioCall = typeof audioCalls.$inferInsert;

export type MeditationSession = typeof meditationSessions.$inferSelect;
export type NewMeditationSession = typeof meditationSessions.$inferInsert;

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

export type QuoteView = typeof quoteViews.$inferSelect;
export type NewQuoteView = typeof quoteViews.$inferInsert;

export type UserStat = typeof userStats.$inferSelect;
export type NewUserStat = typeof userStats.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
