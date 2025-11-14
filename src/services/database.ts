/*
  Lightweight client-side data service that mimics the database API using
  localStorage (or in-memory storage when running server-side). This allows the
  Vite client bundle to avoid loading Node-specific modules such as
  better-sqlite3.
*/

const isBrowser = typeof window !== 'undefined';

export type ID = string;

type StoredDate = string;

type StoredUser = {
  id: ID;
  name: string;
  email: string;
  avatar?: string;
  createdAt: StoredDate;
  updatedAt: StoredDate;
};

type StoredChatSession = {
  id: ID;
  userId: ID;
  title?: string;
  startedAt: StoredDate;
  endedAt?: StoredDate;
  messageCount: number;
  createdAt: StoredDate;
};

type StoredChatMessage = {
  id: ID;
  sessionId: ID;
  userId: ID;
  content: string;
  role: 'user' | 'assistant';
  timestamp: StoredDate;
};

type StoredAudioCall = {
  id: ID;
  userId: ID;
  startedAt: StoredDate;
  endedAt?: StoredDate;
  duration: number;
  status: 'completed' | 'missed' | 'cancelled';
  notes?: string;
  createdAt: StoredDate;
};

type StoredMeditationSession = {
  id: ID;
  userId: ID;
  meditationTitle: string;
  duration: number;
  completedAt: StoredDate;
  rating?: number;
  notes?: string;
  createdAt: StoredDate;
};

type StoredQuote = {
  id: ID;
  text: string;
  author: string;
  category: string;
  createdAt: StoredDate;
};

type StoredQuoteView = {
  id: ID;
  userId: ID;
  quoteId: ID;
  viewedAt: StoredDate;
  liked: boolean;
};

type MemoryType = 'chat' | 'audio';

type StoredConversationMemory = {
  id: ID;
  userId: ID;
  type: MemoryType;
  content: string;
  updatedAt: StoredDate;
};

type StoredUserStats = {
  id: ID;
  userId: ID;
  totalChatSessions: number;
  totalAudioCalls: number;
  totalMeditationMinutes: number;
  totalQuotesViewed: number;
  lastActivity?: StoredDate;
  createdAt: StoredDate;
  updatedAt: StoredDate;
};

type StoredSubscription = {
  id: ID;
  userId: ID;
  plan: 'free' | 'premium';
  status: 'active' | 'inactive' | 'cancelled';
  yookassaPaymentId?: string;
  startedAt: StoredDate;
  expiresAt?: StoredDate;
  autoRenew: boolean;
  createdAt: StoredDate;
  updatedAt: StoredDate;
  audioSessionsLimit?: number;
  audioSessionsUsed?: number;
  lastAudioResetAt?: StoredDate;
};

type DataStore = {
  users: Record<ID, StoredUser>;
  chatSessions: Record<ID, StoredChatSession>;
  chatMessages: Record<ID, StoredChatMessage>;
  audioCalls: Record<ID, StoredAudioCall>;
  meditationSessions: Record<ID, StoredMeditationSession>;
  quotes: Record<ID, StoredQuote>;
  quoteViews: Record<ID, StoredQuoteView>;
  userStats: Record<ID, StoredUserStats>;
  subscriptions: Record<ID, StoredSubscription>;
  conversationMemories: Record<ID, StoredConversationMemory>;
};

const STORAGE_KEY = 'zen-mind-mate-data-v1';

let memoryStore: DataStore | null = null;

const defaultQuoteSeed = [
  {
    text: 'Единственный способ сделать что-то хорошо — полюбить то, что вы делаете.',
    author: 'Стив Джобс',
    category: 'Мотивация',
  },
  {
    text: 'Жизнь — это то, что происходит с вами, пока вы строите другие планы.',
    author: 'Джон Леннон',
    category: 'Жизнь',
  },
  {
    text: 'Путь в тысячу миль начинается с первого шага.',
    author: 'Лао-цзы',
    category: 'Начинания',
  },
  {
    text: 'Не важно, как медленно вы идете, главное — не останавливаться.',
    author: 'Конфуций',
    category: 'Настойчивость',
  },
  {
    text: 'Счастье — это не цель, а способ жить.',
    author: 'Далай-лама',
    category: 'Счастье',
  },
  {
    text: 'Будьте тем изменением, которое хотите видеть в мире.',
    author: 'Махатма Ганди',
    category: 'Вдохновение',
  },
  {
    text: 'Лучшее время посадить дерево было 20 лет назад. Второе лучшее время — сейчас.',
    author: 'Китайская пословица',
    category: 'Действие',
  },
  {
    text: 'Успех — это способность идти от неудачи к неудаче, не теряя энтузиазма.',
    author: 'Уинстон Черчилль',
    category: 'Успех',
  },
  {
    text: 'Ваше время ограничено, не тратьте его на жизнь чужой жизнью.',
    author: 'Стив Джобс',
    category: 'Аутентичность',
  },
  {
    text: 'Единственная невозможная вещь — это та, которую вы не попытались сделать.',
    author: 'Неизвестный автор',
    category: 'Возможности',
  },
  {
    text: 'Падать — это нормально. Подниматься — обязательно.',
    author: 'Конфуций',
    category: 'Стойкость',
  },
  {
    text: 'Мудрость приходит с опытом, а опыт — с ошибками.',
    author: 'Оскар Уайльд',
    category: 'Мудрость',
  },
  {
    text: 'Тот, кто счастлив, хочет, чтобы все вокруг тоже были счастливы.',
    author: 'Анна Франк',
    category: 'Счастье',
  },
  {
    text: 'Настоящая любовь — это не когда ты смотришь друг на друга, а когда вместе смотрите в одном направлении.',
    author: 'Антуан де Сент-Экзюпери',
    category: 'Любовь',
  },
  {
    text: 'Каждый день — это новая возможность стать лучше.',
    author: 'Аристотель',
    category: 'Саморазвитие',
  },
  {
    text: 'Ваше спокойствие ума — это ключ к успеху.',
    author: 'Далай-лама',
    category: 'Спокойствие',
  },
  {
    text: 'Самый большой страх — это страх перед самим собой.',
    author: 'Мишель Лабковский',
    category: 'Страхи',
  },
  {
    text: 'Прошлое нельзя изменить, но будущее можно создать.',
    author: 'Мишель Лабковский',
    category: 'Будущее',
  },
  {
    text: 'Люди часто говорят о том, что хотят изменить свою жизнь, но редко меняют то, что делают каждый день.',
    author: 'Мишель Лабковский',
    category: 'Изменения',
  },
  {
    text: 'Человек может все, если он достаточно хочет этого.',
    author: 'Бенджамин Франклин',
    category: 'Воля',
  },
  {
    text: 'Секрет успеха в том, чтобы начать.',
    author: 'Марк Твен',
    category: 'Начало',
  },
  {
    text: 'Не позволяйте тому, что вы не можете сделать, мешать тому, что вы можете сделать.',
    author: 'Джон Вуден',
    category: 'Возможности',
  },
  {
    text: 'Жизнь слишком коротка, чтобы тратить ее на негатив.',
    author: 'Карл Густав Юнг',
    category: 'Позитив',
  },
  {
    text: 'Истинное богатство — это не в том, что у вас есть, а в том, кого вы любите.',
    author: 'Ричард Брэнсон',
    category: 'Ценности',
  },
  {
    text: 'Самое важное путешествие — это путешествие внутрь себя.',
    author: 'Ральф Уолдо Эмерсон',
    category: 'Самопознание',
  },
  {
    text: 'Мир — это зеркало, и он отражает то, что внутри вас.',
    author: 'Карл Густав Юнг',
    category: 'Восприятие',
  },
  {
    text: 'Когда одна дверь закрывается, другая открывается.',
    author: 'Александр Грэм Белл',
    category: 'Перемены',
  },
  {
    text: 'Лучший способ предсказать будущее — это создать его.',
    author: 'Питер Друкер',
    category: 'Будущее',
  },
  {
    text: 'Сила не в том, чтобы никогда не падать, а в том, чтобы каждый раз подниматься.',
    author: 'Винс Ломбарди',
    category: 'Стойкость',
  },
  {
    text: 'Маленькие ежедневные улучшения — это ключ к большим изменениям.',
    author: 'Джеймс Клир',
    category: 'Привычки',
  },
  {
    text: 'Дисциплина — это мост между целями и достижениями.',
    author: 'Джим Рон',
    category: 'Дисциплина',
  },
  {
    text: 'Настоящее счастье приходит не от получения того, что хочешь, а от желания того, что имеешь.',
    author: 'Шопенгауэр',
    category: 'Благодарность',
  },
  {
    text: 'Каждый человек несет в себе целый мир.',
    author: 'Гёте',
    category: 'Самоценность',
  },
  {
    text: 'Жизнь — это не ожидание бури, а обучение танцевать под дождем.',
    author: 'Вивьен Грин',
    category: 'Адаптация',
  },
  {
    text: 'Самый счастливый человек — тот, кто приносит счастье наибольшему количеству людей.',
    author: 'Денис Дидро',
    category: 'Альтруизм',
  },
  {
    text: 'Ваш ум — как парашют: он работает только тогда, когда открыт.',
    author: 'Фрэнк Зappa',
    category: 'Открытость',
  },
  {
    text: 'Никогда не поздно стать тем, кем вы могли бы быть.',
    author: 'Джордж Элиот',
    category: 'Потенциал',
  },
  {
    text: 'Самое важное в общении — это умение слушать.',
    author: 'Эрнест Хемингуэй',
    category: 'Общение',
  },
  {
    text: 'Творчество — это интеллект, который развлекается.',
    author: 'Альберт Эйнштейн',
    category: 'Творчество',
  },
  {
    text: 'Свобода начинается с понимания, что вы несете ответственность за свои действия.',
    author: 'Мишель Лабковский',
    category: 'Свобода',
  },
  {
    text: 'Каждый день — это новая страница в вашей истории.',
    author: 'Пауло Коэльо',
    category: 'Жизнь',
  },
  {
    text: 'Истинная мудрость — в признании своего невежества.',
    author: 'Сократ',
    category: 'Мудрость',
  },
  {
    text: 'Любовь к себе — это начало пожизненного романа.',
    author: 'Оскар Уайльд',
    category: 'Самолюбовь',
  },
  {
    text: 'Будьте добры, потому что все, кого вы встречаете, ведут тяжелую борьбу.',
    author: 'Платон',
    category: 'Доброта',
  },
  {
    text: 'Самый сильный — тот, кто умеет контролировать свои эмоции.',
    author: 'Лао-цзы',
    category: 'Эмоциональный интеллект',
  },
  {
    text: 'Время — самый ценный ресурс. Не тратьте его на то, что не важно.',
    author: 'Тим Феррис',
    category: 'Время',
  },
  {
    text: 'Страх — это всего лишь иллюзия. За ним всегда стоит выбор.',
    author: 'Мишель Лабковский',
    category: 'Страхи',
  },
  {
    text: 'Истинный успех измеряется не тем, что вы достигли, а тем, чем вы стали.',
    author: 'Зиг Зиглар',
    category: 'Успех',
  },
];

function createDefaultStore(): DataStore {
  const now = new Date().toISOString();

  const quotes: Record<ID, StoredQuote> = {};
  defaultQuoteSeed.forEach((quote, index) => {
    const id = `quote_${index + 1}`;
    quotes[id] = {
      id,
      ...quote,
      createdAt: now,
    };
  });

  return {
    users: {},
    chatSessions: {},
    chatMessages: {},
    audioCalls: {},
    meditationSessions: {},
    quotes,
    quoteViews: {},
    userStats: {},
    subscriptions: {},
    conversationMemories: {},
  };
}

function loadStore(): DataStore {
  if (!isBrowser) {
    if (!memoryStore) {
      memoryStore = createDefaultStore();
    }
    return structuredClone(memoryStore);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const store = createDefaultStore();
    saveStore(store);
    return store;
  }

  try {
    const store = JSON.parse(raw) as DataStore;

    // Check if we need to update quotes with new ones
    const existingQuoteCount = Object.keys(store.quotes).length;
    const newQuoteCount = defaultQuoteSeed.length;

    if (existingQuoteCount < newQuoteCount) {
      console.log(`Updating quotes: ${existingQuoteCount} -> ${newQuoteCount}`);
      const now = new Date().toISOString();

      // Add new quotes to existing store
      defaultQuoteSeed.forEach((quote, index) => {
        const id = `quote_${index + 1}`;
        if (!store.quotes[id]) {
          store.quotes[id] = {
            id,
            ...quote,
            createdAt: now,
          };
        }
      });

      saveStore(store);
    }

    let needsSave = false;
    if (!store.conversationMemories) {
      store.conversationMemories = {};
      needsSave = true;
    }

    Object.values(store.subscriptions ?? {}).forEach((subscription) => {
      if (ensureSubscriptionAudioUsage(subscription, new Date())) {
        needsSave = true;
      }
    });

    if (needsSave) {
      saveStore(store);
    }

    return store;
  } catch (error) {
    console.error('Failed to parse stored data. Resetting store.', error);
    const store = createDefaultStore();
    saveStore(store);
    return store;
  }
}

function saveStore(store: DataStore) {
  if (!isBrowser) {
    memoryStore = structuredClone(store);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

const delay = () => Promise.resolve();

function generateId(prefix = 'id'): ID {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function toDate(value?: StoredDate): Date | undefined {
  return value ? new Date(value) : undefined;
}

function toDateRequired(value: StoredDate): Date {
  return new Date(value);
}

export type User = Omit<StoredUser, 'createdAt' | 'updatedAt'> & {
  createdAt: Date;
  updatedAt: Date;
};

export type ChatSession = Omit<StoredChatSession, 'startedAt' | 'endedAt' | 'createdAt'> & {
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
};

export type ChatMessage = Omit<StoredChatMessage, 'timestamp'> & {
  timestamp: Date;
};

export type AudioCall = Omit<StoredAudioCall, 'startedAt' | 'endedAt' | 'createdAt'> & {
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
};

export type MeditationSession = Omit<StoredMeditationSession, 'completedAt' | 'createdAt'> & {
  completedAt: Date;
  createdAt: Date;
};

export type Quote = Omit<StoredQuote, 'createdAt'> & {
  createdAt: Date;
};

export type QuoteView = Omit<StoredQuoteView, 'viewedAt'> & {
  viewedAt: Date;
};

export type UserStat = Omit<StoredUserStats, 'lastActivity' | 'createdAt' | 'updatedAt'> & {
  lastActivity?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type Subscription = Omit<StoredSubscription, 'startedAt' | 'expiresAt' | 'createdAt' | 'updatedAt' | 'lastAudioResetAt'> & {
  startedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastAudioResetAt?: Date;
};

const MAX_MEMORY_LENGTH = 2000;
const PREMIUM_AUDIO_SESSIONS_LIMIT = 4;

function ensureSubscriptionAudioUsage(subscription: StoredSubscription, now: Date): boolean {
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

function getLatestSubscriptionRecord(store: DataStore, userId: ID): StoredSubscription | undefined {
  const subscriptions = Object.values(store.subscriptions ?? {});
  if (subscriptions.length === 0) {
    return undefined;
  }

  return subscriptions
    .filter((sub) => sub.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

const convertUser = (user: StoredUser): User => ({
  ...user,
  createdAt: toDateRequired(user.createdAt),
  updatedAt: toDateRequired(user.updatedAt),
});

const convertChatSession = (session: StoredChatSession): ChatSession => ({
  ...session,
  startedAt: toDateRequired(session.startedAt),
  endedAt: toDate(session.endedAt),
  createdAt: toDateRequired(session.createdAt),
});

const convertChatMessage = (message: StoredChatMessage): ChatMessage => ({
  ...message,
  timestamp: toDateRequired(message.timestamp),
});

const convertAudioCall = (call: StoredAudioCall): AudioCall => ({
  ...call,
  startedAt: toDateRequired(call.startedAt),
  endedAt: toDate(call.endedAt),
  createdAt: toDateRequired(call.createdAt),
});

const convertMeditationSession = (session: StoredMeditationSession): MeditationSession => ({
  ...session,
  completedAt: toDateRequired(session.completedAt),
  createdAt: toDateRequired(session.createdAt),
});

const convertQuote = (quote: StoredQuote): Quote => ({
  ...quote,
  createdAt: toDateRequired(quote.createdAt),
});

const convertQuoteView = (view: StoredQuoteView): QuoteView => ({
  ...view,
  viewedAt: toDateRequired(view.viewedAt),
});

const convertUserStats = (stats: StoredUserStats): UserStat => ({
  ...stats,
  createdAt: toDateRequired(stats.createdAt),
  updatedAt: toDateRequired(stats.updatedAt),
  lastActivity: toDate(stats.lastActivity),
});

const convertSubscription = (subscription: StoredSubscription): Subscription => ({
  ...subscription,
  startedAt: toDateRequired(subscription.startedAt),
  expiresAt: toDate(subscription.expiresAt),
  createdAt: toDateRequired(subscription.createdAt),
  updatedAt: toDateRequired(subscription.updatedAt),
  lastAudioResetAt: toDate(subscription.lastAudioResetAt),
});

async function refreshUserStats(userId: ID) {
  await userStatsService.updateUserStats(userId);
}

export const userService = {
  async getUserById(id: ID): Promise<User | undefined> {
    await delay();
    const store = loadStore();
    const user = store.users[id];
    return user ? convertUser(user) : undefined;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    await delay();
    const store = loadStore();
    const user = Object.values(store.users).find((u) => u.email === email);
    return user ? convertUser(user) : undefined;
  },

  async createUser(email: string, name: string): Promise<User> {
    await delay();
    const store = loadStore();
    const now = new Date().toISOString();

    const user: StoredUser = {
      id: generateId('user'),
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };

    store.users[user.id] = user;
    saveStore(store);

    const userId = user.id;
    const existingSubscription = Object.values(store.subscriptions ?? {}).find((sub) => sub.userId === userId);
    if (!existingSubscription) {
      const nowIso = new Date().toISOString();
      const subscriptionId = generateId('subscription');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const subscription: StoredSubscription = {
        id: subscriptionId,
        userId,
        plan: 'premium',
        status: 'active',
        startedAt: nowIso,
        expiresAt,
        autoRenew: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        audioSessionsLimit: PREMIUM_AUDIO_SESSIONS_LIMIT,
        audioSessionsUsed: 0,
        lastAudioResetAt: nowIso,
      };

      store.subscriptions[subscriptionId] = subscription;
      saveStore(store);
    }

    return convertUser(user);
  },

  async updateUser(id: ID, data: Partial<Omit<User, 'id'>>): Promise<User | undefined> {
    await delay();
    const store = loadStore();
    const user = store.users[id];
    if (!user) {
      return undefined;
    }

    const updatedUser: StoredUser = {
      ...user,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    store.users[id] = updatedUser;
    saveStore(store);

    await refreshUserStats(id);

    return convertUser(updatedUser);
  },

  async getOrCreateUser(email: string, name: string): Promise<User> {
    await delay();
    const store = loadStore();
    let user = Object.values(store.users).find((u) => u.email === email);

    if (!user) {
      const id = generateId('user');
      const now = new Date().toISOString();
      user = {
        id,
        name,
        email,
        createdAt: now,
        updatedAt: now,
      };

      store.users[id] = user;

      store.userStats[id] = {
        id: generateId('user_stat'),
        userId: id,
        totalChatSessions: 0,
        totalAudioCalls: 0,
        totalMeditationMinutes: 0,
        totalQuotesViewed: 0,
        createdAt: now,
        updatedAt: now,
      };

      const existingSubscription = Object.values(store.subscriptions ?? {}).find((sub) => sub.userId === id);
      if (!existingSubscription) {
        const subscriptionId = generateId('subscription');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const subscription: StoredSubscription = {
          id: subscriptionId,
          userId: id,
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
        };

        store.subscriptions[subscriptionId] = subscription;
      }

      saveStore(store);
    }

    return convertUser(user);
  },
};

export const chatService = {
  async createChatSession(userId: ID, title?: string): Promise<ChatSession> {
    await delay();
    const store = loadStore();
    const id = generateId('chat_session');
    const now = new Date().toISOString();

    const session: StoredChatSession = {
      id,
      userId,
      title,
      startedAt: now,
      createdAt: now,
      messageCount: 0,
    };

    store.chatSessions[id] = session;
    saveStore(store);

    await refreshUserStats(userId);

    return convertChatSession(session);
  },

  async endChatSession(sessionId: ID): Promise<ChatSession | undefined> {
    await delay();
    const store = loadStore();
    const session = store.chatSessions[sessionId];
    if (!session) {
      return undefined;
    }

    session.endedAt = new Date().toISOString();
    store.chatSessions[sessionId] = session;
    saveStore(store);

    await refreshUserStats(session.userId);

    return convertChatSession(session);
  },

  async addChatMessage(
    sessionId: ID,
    userId: ID,
    content: string,
    role: 'user' | 'assistant',
  ): Promise<ChatMessage | undefined> {
    await delay();
    const store = loadStore();
    const session = store.chatSessions[sessionId];
    if (!session) {
      return undefined;
    }

    const id = generateId('chat_message');
    const now = new Date().toISOString();

    const message: StoredChatMessage = {
      id,
      sessionId,
      userId,
      content,
      role,
      timestamp: now,
    };

    store.chatMessages[id] = message;
    session.messageCount += 1;
    store.chatSessions[sessionId] = session;
    saveStore(store);

    await refreshUserStats(userId);

    return convertChatMessage(message);
  },

  async getChatMessages(sessionId: ID): Promise<ChatMessage[]> {
    await delay();
    const store = loadStore();
    return Object.values(store.chatMessages)
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(convertChatMessage);
  },

  async getUserChatSessions(userId: ID, limit = 10): Promise<ChatSession[]> {
    await delay();
    const store = loadStore();
    return Object.values(store.chatSessions)
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(convertChatSession);
  },
};

export const audioCallService = {
  async createAudioCall(userId: ID): Promise<AudioCall> {
    await delay();
    const store = loadStore();
    const id = generateId('audio_call');
    const now = new Date().toISOString();

    const call: StoredAudioCall = {
      id,
      userId,
      startedAt: now,
      createdAt: now,
      duration: 0,
      status: 'completed',
    };

    store.audioCalls[id] = call;
    saveStore(store);

    await refreshUserStats(userId);

    return convertAudioCall(call);
  },

  async endAudioCall(callId: ID, duration: number): Promise<AudioCall | undefined> {
    await delay();
    const store = loadStore();
    const call = store.audioCalls[callId];
    if (!call) {
      return undefined;
    }

    call.endedAt = new Date().toISOString();
    call.duration = duration;
    store.audioCalls[callId] = call;
    saveStore(store);

    await refreshUserStats(call.userId);

    return convertAudioCall(call);
  },

  async getUserAudioCalls(userId: ID, limit = 10): Promise<AudioCall[]> {
    await delay();
    const store = loadStore();
    return Object.values(store.audioCalls)
      .filter((call) => call.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(convertAudioCall);
  },
};

export const meditationService = {
  async createMeditationSession(
    userId: ID,
    meditationTitle: string,
    duration: number,
    rating?: number,
    notes?: string,
  ): Promise<MeditationSession> {
    await delay();
    const store = loadStore();
    const id = generateId('meditation');
    const now = new Date().toISOString();

    const session: StoredMeditationSession = {
      id,
      userId,
      meditationTitle,
      duration,
      completedAt: now,
      rating,
      notes,
      createdAt: now,
    };

    store.meditationSessions[id] = session;
    saveStore(store);

    await refreshUserStats(userId);

    return convertMeditationSession(session);
  },

  async getUserMeditationSessions(userId: ID, limit = 20): Promise<MeditationSession[]> {
    await delay();
    const store = loadStore();
    return Object.values(store.meditationSessions)
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, limit)
      .map(convertMeditationSession);
  },

  async getUserMeditationStats(userId: ID): Promise<{
    totalSessions: number;
    totalMinutes: number;
    avgRating: number;
  }> {
    await delay();
    const store = loadStore();
    const sessions = Object.values(store.meditationSessions).filter((session) => session.userId === userId);

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

export const quoteService = {
  async getAllQuotes(): Promise<Quote[]> {
    await delay();
    const store = loadStore();
    return Object.values(store.quotes)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(convertQuote);
  },

  async viewQuote(userId: ID, quoteId: ID, liked = false): Promise<QuoteView> {
    await delay();
    const store = loadStore();
    const id = generateId('quote_view');
    const now = new Date().toISOString();

    const view: StoredQuoteView = {
      id,
      userId,
      quoteId,
      viewedAt: now,
      liked,
    };

    store.quoteViews[id] = view;
    saveStore(store);

    await refreshUserStats(userId);

    return convertQuoteView(view);
  },

  async toggleQuoteLike(userId: ID, quoteId: ID): Promise<QuoteView> {
    await delay();
    const store = loadStore();

    const views = Object.values(store.quoteViews)
      .filter((view) => view.userId === userId && view.quoteId === quoteId)
      .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt));

    let target = views[0];

    if (!target) {
      target = {
        id: generateId('quote_view'),
        userId,
        quoteId,
        viewedAt: new Date().toISOString(),
        liked: true,
      };
    } else {
      target = {
        ...target,
        liked: !target.liked,
        viewedAt: new Date().toISOString(),
      };
    }

    store.quoteViews[target.id] = target;
    saveStore(store);

    await refreshUserStats(userId);

    return convertQuoteView(target);
  },

  async getUserQuoteViews(userId: ID, limit = 20): Promise<{ view: QuoteView; quote: Quote }[]> {
    await delay();
    const store = loadStore();

    return Object.values(store.quoteViews)
      .filter((view) => view.userId === userId)
      .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
      .slice(0, limit)
      .map((view) => ({
        view: convertQuoteView(view),
        quote: convertQuote(store.quotes[view.quoteId]),
      }));
  },

  async getUserQuoteStats(userId: ID): Promise<{ totalViewed: number; totalLiked: number }> {
    await delay();
    const store = loadStore();
    const views = Object.values(store.quoteViews).filter((view) => view.userId === userId);

    return {
      totalViewed: views.length,
      totalLiked: views.filter((view) => view.liked).length,
    };
  },

  async getUserLikedQuotes(userId: ID, limit = 50): Promise<{ quote: Quote; view: QuoteView }[]> {
    await delay();
    const store = loadStore();

    return Object.values(store.quoteViews)
      .filter((view) => view.userId === userId && view.liked)
      .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
      .slice(0, limit)
      .map((view) => ({
        quote: convertQuote(store.quotes[view.quoteId]),
        view: convertQuoteView(view),
      }));
  },
};

export const userStatsService = {
  async updateUserStats(userId: ID): Promise<void> {
    await delay();
    const store = loadStore();

    const chatSessions = Object.values(store.chatSessions).filter((session) => session.userId === userId);
    const audioCalls = Object.values(store.audioCalls).filter((call) => call.userId === userId);
    const meditationSessions = await meditationService.getUserMeditationStats(userId);
    const quoteStats = await quoteService.getUserQuoteStats(userId);

    const now = new Date().toISOString();

    const stats = store.userStats[userId] ?? {
      id: generateId('user_stat'),
      userId,
      totalChatSessions: 0,
      totalAudioCalls: 0,
      totalMeditationMinutes: 0,
      totalQuotesViewed: 0,
      createdAt: now,
      updatedAt: now,
    };

    stats.totalChatSessions = chatSessions.length;
    stats.totalAudioCalls = audioCalls.length;
    stats.totalMeditationMinutes = meditationSessions.totalMinutes;
    stats.totalQuotesViewed = quoteStats.totalViewed;
    stats.lastActivity = now;
    stats.updatedAt = now;

    store.userStats[userId] = stats;
    saveStore(store);
  },

  async getUserStats(userId: ID): Promise<UserStat> {
    await delay();
    const store = loadStore();
    let stats = store.userStats[userId];

    if (!stats) {
      const now = new Date().toISOString();
      stats = {
        id: generateId('user_stat'),
        userId,
        totalChatSessions: 0,
        totalAudioCalls: 0,
        totalMeditationMinutes: 0,
        totalQuotesViewed: 0,
        createdAt: now,
        updatedAt: now,
      };
      store.userStats[userId] = stats;
      saveStore(store);
    }

    return convertUserStats(stats);
  },
};

export const subscriptionService = {
  async getUserSubscription(userId: ID): Promise<Subscription | undefined> {
    await delay();
    const store = loadStore();
    const record = getLatestSubscriptionRecord(store, userId);
    if (!record) {
      return undefined;
    }

    if (ensureSubscriptionAudioUsage(record, new Date())) {
      saveStore(store);
    }

    return convertSubscription(record);
  },

  async createSubscription(
    userId: ID,
    plan: 'free' | 'premium',
    yookassaPaymentId?: string
  ): Promise<Subscription> {
    await delay();
    const store = loadStore();

    // Initialize subscriptions if it doesn't exist
    if (!store.subscriptions) {
      store.subscriptions = {};
    }

    const id = generateId('subscription');
    const now = new Date().toISOString();
    const expiresAt = plan === 'premium' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined;

    const subscription: StoredSubscription = {
      id,
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

    store.subscriptions[id] = subscription;
    saveStore(store);

    await refreshUserStats(userId);

    return convertSubscription(subscription);
  },

  async updateSubscriptionStatus(
    subscriptionId: ID,
    status: 'active' | 'inactive' | 'cancelled'
  ): Promise<Subscription | undefined> {
    await delay();
    const store = loadStore();
    if (!store.subscriptions) {
      return undefined;
    }
    const subscription = store.subscriptions[subscriptionId];

    if (!subscription) {
      return undefined;
    }

    subscription.status = status;
    subscription.updatedAt = new Date().toISOString();

    ensureSubscriptionAudioUsage(subscription, new Date());

    store.subscriptions[subscriptionId] = subscription;
    saveStore(store);

    await refreshUserStats(subscription.userId);

    return convertSubscription(subscription);
  },

  async cancelSubscription(subscriptionId: ID): Promise<Subscription | undefined> {
    return await subscriptionService.updateSubscriptionStatus(subscriptionId, 'cancelled');
  },

  async getUserSubscriptions(userId: ID): Promise<Subscription[]> {
    await delay();
    const store = loadStore();
    if (!store.subscriptions) {
      return [];
    }
    const now = new Date();
    const subscriptions = Object.values(store.subscriptions)
      .filter(sub => sub.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    let changed = false;
    subscriptions.forEach((sub) => {
      if (ensureSubscriptionAudioUsage(sub, now)) {
        changed = true;
      }
    });

    if (changed) {
      saveStore(store);
    }

    return subscriptions.map(convertSubscription);
  },

  async getAudioSessionInfo(userId: ID): Promise<{ plan: 'premium' | 'free' | 'none'; remaining: number; limit: number; status: 'active' | 'inactive' | 'cancelled' | 'none' }> {
    await delay();
    const store = loadStore();
    const record = getLatestSubscriptionRecord(store, userId);
    const now = new Date();

    if (record) {
      if (ensureSubscriptionAudioUsage(record, now)) {
        saveStore(store);
      }

      const limit = record.audioSessionsLimit ?? (record.plan === 'premium' ? PREMIUM_AUDIO_SESSIONS_LIMIT : 0);
      const used = record.audioSessionsUsed ?? 0;
      const remaining = Math.max(0, limit - used);

      return {
        plan: record.plan,
        remaining,
        limit,
        status: record.status,
      };
    }

    return {
      plan: 'none',
      remaining: 0,
      limit: 0,
      status: 'none',
    };
  },

  async recordAudioSession(userId: ID): Promise<{ success: boolean; remaining: number; limit: number; message?: string }> {
    await delay();
    const store = loadStore();
    const record = getLatestSubscriptionRecord(store, userId);

    if (!record || record.plan !== 'premium' || record.status !== 'active') {
      return { success: false, remaining: 0, limit: 0, message: 'Нет активной премиум подписки' };
    }

    const now = new Date();
    ensureSubscriptionAudioUsage(record, now);

    const limit = record.audioSessionsLimit ?? PREMIUM_AUDIO_SESSIONS_LIMIT;
    const used = record.audioSessionsUsed ?? 0;

    if (used >= limit) {
      saveStore(store);
      return { success: false, remaining: 0, limit, message: 'Лимит аудио сессий исчерпан' };
    }

    record.audioSessionsUsed = used + 1;
    record.updatedAt = now.toISOString();
    store.subscriptions[record.id] = record;
    saveStore(store);

    return {
      success: true,
      remaining: Math.max(0, limit - record.audioSessionsUsed),
      limit,
    };
  },
};

const buildMemoryKey = (userId: ID, type: MemoryType) => `${type}_${userId}`;

export const memoryService = {
  async getMemory(userId: ID, type: MemoryType): Promise<string> {
    await delay();
    const store = loadStore();
    const key = buildMemoryKey(userId, type);
    const memory = store.conversationMemories[key];
    return memory ? memory.content : '';
  },

  async setMemory(userId: ID, type: MemoryType, content: string): Promise<string> {
    await delay();
    const store = loadStore();
    const key = buildMemoryKey(userId, type);
    const now = new Date().toISOString();

    const trimmedContent = content.trim();

    store.conversationMemories[key] = {
      id: buildMemoryKey(userId, type),
      userId,
      type,
      content: trimmedContent,
      updatedAt: now,
    };

    saveStore(store);
    return trimmedContent;
  },

  async appendMemory(userId: ID, type: MemoryType, entry: string, maxLength = MAX_MEMORY_LENGTH): Promise<string> {
    await delay();
    const store = loadStore();
    const key = buildMemoryKey(userId, type);
    const now = new Date().toISOString();

    const existing = store.conversationMemories[key]?.content ?? '';
    const combined = [existing, entry.trim()].filter(Boolean).join('\n').trim();
    const truncated = combined.length > maxLength ? combined.slice(combined.length - maxLength) : combined;

    store.conversationMemories[key] = {
      id: buildMemoryKey(userId, type),
      userId,
      type,
      content: truncated,
      updatedAt: now,
    };

    saveStore(store);
    return truncated;
  },

  async clearMemory(userId: ID, type: MemoryType): Promise<void> {
    await delay();
    const store = loadStore();
    const key = buildMemoryKey(userId, type);
    if (store.conversationMemories[key]) {
      delete store.conversationMemories[key];
      saveStore(store);
    }
  },
};
