"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptions = exports.userStats = exports.quoteViews = exports.quotes = exports.meditationSessions = exports.audioCalls = exports.chatMessages = exports.chatSessions = exports.users = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const cuid2_1 = require("@paralleldrive/cuid2");
// Users table
exports.users = (0, sqlite_core_1.sqliteTable)('users', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    name: (0, sqlite_core_1.text)('name').notNull(),
    email: (0, sqlite_core_1.text)('email').notNull().unique(),
    avatar: (0, sqlite_core_1.text)('avatar'),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at', { mode: 'timestamp' }).notNull(),
});
// Chat Sessions table
exports.chatSessions = (0, sqlite_core_1.sqliteTable)('chat_sessions', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, sqlite_core_1.text)('user_id').notNull().references(() => exports.users.id),
    title: (0, sqlite_core_1.text)('title'),
    startedAt: (0, sqlite_core_1.integer)('started_at').notNull(),
    endedAt: (0, sqlite_core_1.integer)('ended_at'),
    messageCount: (0, sqlite_core_1.integer)('message_count').notNull().default(0),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull(),
});
// Chat Messages table
exports.chatMessages = (0, sqlite_core_1.sqliteTable)('chat_messages', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    sessionId: (0, sqlite_core_1.text)('session_id').notNull().references(() => exports.chatSessions.id),
    userId: (0, sqlite_core_1.text)('user_id').notNull().references(() => exports.users.id),
    content: (0, sqlite_core_1.text)('content').notNull(),
    role: (0, sqlite_core_1.text)('role').notNull(), // 'user' or 'assistant'
    timestamp: (0, sqlite_core_1.integer)('timestamp').notNull(),
});
// Audio Calls table
exports.audioCalls = (0, sqlite_core_1.sqliteTable)('audio_calls', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, sqlite_core_1.text)('user_id').notNull().references(() => exports.users.id),
    startedAt: (0, sqlite_core_1.integer)('started_at').notNull(),
    endedAt: (0, sqlite_core_1.integer)('ended_at'),
    duration: (0, sqlite_core_1.integer)('duration').notNull(), // in seconds
    status: (0, sqlite_core_1.text)('status').notNull().default('completed'), // 'completed', 'missed', 'cancelled'
    notes: (0, sqlite_core_1.text)('notes'),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull(),
});
// Meditation Sessions table
exports.meditationSessions = (0, sqlite_core_1.sqliteTable)('meditation_sessions', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, sqlite_core_1.text)('user_id').notNull().references(() => exports.users.id),
    meditationTitle: (0, sqlite_core_1.text)('meditation_title').notNull(),
    duration: (0, sqlite_core_1.integer)('duration').notNull(), // in minutes
    completedAt: (0, sqlite_core_1.integer)('completed_at').notNull(),
    rating: (0, sqlite_core_1.integer)('rating'), // 1-5 stars
    notes: (0, sqlite_core_1.text)('notes'),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull(),
});
// Quotes table
exports.quotes = (0, sqlite_core_1.sqliteTable)('quotes', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    text: (0, sqlite_core_1.text)('text').notNull(),
    author: (0, sqlite_core_1.text)('author').notNull(),
    category: (0, sqlite_core_1.text)('category').notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull(),
});
// Quote Views table
exports.quoteViews = (0, sqlite_core_1.sqliteTable)('quote_views', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, sqlite_core_1.text)('user_id').notNull().references(() => exports.users.id),
    quoteId: (0, sqlite_core_1.text)('quote_id').notNull().references(() => exports.quotes.id),
    viewedAt: (0, sqlite_core_1.integer)('viewed_at').notNull(),
    liked: (0, sqlite_core_1.integer)('liked').notNull().default(0), // 0 or 1
});
// User Statistics table
exports.userStats = (0, sqlite_core_1.sqliteTable)('user_stats', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, sqlite_core_1.text)('user_id').notNull().references(() => exports.users.id).unique(),
    totalChatSessions: (0, sqlite_core_1.integer)('total_chat_sessions').notNull().default(0),
    totalAudioCalls: (0, sqlite_core_1.integer)('total_audio_calls').notNull().default(0),
    totalMeditationMinutes: (0, sqlite_core_1.integer)('total_meditation_minutes').notNull().default(0),
    totalQuotesViewed: (0, sqlite_core_1.integer)('total_quotes_viewed').notNull().default(0),
    lastActivity: (0, sqlite_core_1.integer)('last_activity'),
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at').notNull(),
});
// Subscriptions table
exports.subscriptions = (0, sqlite_core_1.sqliteTable)('subscriptions', {
    id: (0, sqlite_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, sqlite_core_1.text)('user_id').notNull().references(() => exports.users.id),
    plan: (0, sqlite_core_1.text)('plan').notNull(), // 'free' or 'premium'
    status: (0, sqlite_core_1.text)('status').notNull().default('active'), // 'active', 'inactive', 'cancelled'
    yookassaPaymentId: (0, sqlite_core_1.text)('yookassa_payment_id'),
    startedAt: (0, sqlite_core_1.integer)('started_at').notNull(),
    expiresAt: (0, sqlite_core_1.integer)('expires_at'),
    autoRenew: (0, sqlite_core_1.integer)('auto_renew').notNull().default(1), // 0 or 1
    createdAt: (0, sqlite_core_1.integer)('created_at').notNull(),
    updatedAt: (0, sqlite_core_1.integer)('updated_at').notNull(),
    audioSessionsLimit: (0, sqlite_core_1.integer)('audio_sessions_limit'),
    audioSessionsUsed: (0, sqlite_core_1.integer)('audio_sessions_used').default(0),
    lastAudioResetAt: (0, sqlite_core_1.integer)('last_audio_reset_at'),
});
