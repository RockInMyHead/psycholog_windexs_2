// API service for client-side communication with server
const API_FALLBACK_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_ORIGIN) ||
  'https://psycholog.windexs.ru';

// Always use relative paths when in browser - Vite proxy will handle it
const isDevelopment = typeof window !== 'undefined';

// Debug logs for development
if (typeof window !== 'undefined') {
  console.log('[API Service] Using local proxy for API calls');
  console.log('[API Service] Fallback origin:', API_FALLBACK_ORIGIN);
}

const API_BASE = '/api';

function buildApiUrl(endpoint: string) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // In development (browser), use relative paths to leverage Vite proxy
  // In production (server-side), use full URL
  if (isDevelopment) {
    return `/api${normalizedEndpoint}`;
  }

  // Always use full URL for consistency and to avoid URL parsing issues
  return `${API_FALLBACK_ORIGIN}/api${normalizedEndpoint}`;
}

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = buildApiUrl(endpoint);
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Always include credentials for session cookies
    ...options,
  };

  // Ensure body is properly serialized if it's an object
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    try {
      config.body = JSON.stringify(config.body);
    } catch (error) {
      console.error('Failed to serialize request body:', error);
      throw new Error('Cannot serialize request body - contains circular references');
    }
  }

  try {
    console.log('[API] Request:', config.method || 'GET', url);
    const response = await fetch(url, config);
    if (!response.ok) {
      const error = new Error(
        `API call failed: ${response.status} ${response.statusText}`
      ) as Error & { status: number; statusText: string; body?: string };
      error.status = response.status;
      error.statusText = response.statusText;
      error.body = await response.text().catch(() => undefined);
      console.error('[API] Error response:', error.status, error.statusText, error.body);
      throw error;
    }
    if (response.status === 204) {
      console.log('[API] Success (204):', url);
      return null;
    }
    const result = await response.json();
    console.log('[API] Success:', url, result);
    return result;
  } catch (error) {
    console.error('[API] Request failed:', url, error);
    throw error;
  }
}

// Auth service
export const authApi = {
  async register(email: string, password: string, name: string) {
    return await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
      credentials: 'include', // Important for cookies
    });
  },

  async login(email: string, password: string) {
    return await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      credentials: 'include', // Important for cookies
    });
  },

  async logout() {
    return await apiCall('/auth/logout', {
      method: 'POST',
      credentials: 'include', // Important for cookies
    });
  },

  async getSession() {
    return await apiCall('/auth/session', {
      method: 'GET',
      credentials: 'include', // Important for cookies
    });
  },
};

// User service
export const userApi = {
  async getOrCreateUser(email: string, name: string) {
    return await apiCall('/users', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  },

  async getUser(userId: string) {
    return await apiCall(`/users/${userId}`);
  },

  async getUserByEmail(email: string) {
    try {
      return await apiCall(
        `/users/by-email?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
        }
      );
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      if (status === 404) {
        return null;
      }
      throw error;
    }
  },

  async updateUser(userId: string, data: Record<string, unknown>) {
    return await apiCall(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Chat service
export const chatApi = {
  async createChatSession(userId: string, title: string) {
    return await apiCall('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ userId, title }),
    });
  },

  async endChatSession(sessionId: string) {
    return await apiCall(`/chat/sessions/${sessionId}/end`, {
      method: 'PUT',
    });
  },

  async addChatMessage(sessionId: string, userId: string, content: string, role: string) {
    return await apiCall('/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ sessionId, userId, content, role }),
    });
  },

  async getChatMessages(sessionId: string) {
    return await apiCall(`/chat/sessions/${sessionId}/messages`);
  },

  async getUserChatSessions(userId: string, limit = 10) {
    return await apiCall(`/users/${userId}/chat-sessions?limit=${limit}`);
  },
};

// Audio call service
export const audioCallApi = {
  async createAudioCall(userId: string) {
    return await apiCall('/audio-calls', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async endAudioCall(callId: string, duration: number) {
    return await apiCall(`/audio-calls/${callId}/end`, {
      method: 'PUT',
      body: JSON.stringify({ duration }),
    });
  },

  async getUserAudioCalls(userId: string, limit = 10) {
    return await apiCall(`/users/${userId}/audio-calls?limit=${limit}`);
  },
};

// Meditation service
export const meditationApi = {
  async createMeditationSession(userId: string, meditationTitle: string, duration: number, rating?: number, notes?: string) {
    return await apiCall('/meditations', {
      method: 'POST',
      body: JSON.stringify({ userId, meditationTitle, duration, rating, notes }),
    });
  },

  async getUserMeditationSessions(userId: string, limit = 20) {
    return await apiCall(`/users/${userId}/meditations?limit=${limit}`);
  },

  async getUserMeditationStats(userId: string) {
    return await apiCall(`/users/${userId}/meditations/stats`);
  },
};

// Wallet service
export const walletApi = {
  async getWallet(userId: string) {
    return await apiCall(`/wallet?userId=${encodeURIComponent(userId)}`);
  },

  async topUp(userId: string, amountRub: number, meta?: Record<string, unknown>) {
    return await apiCall('/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ userId, amount: amountRub, meta }),
    });
  },

  async debit(userId: string, amountRub: number, reason?: string, idempotencyKey?: string) {
    return await apiCall('/wallet/debit', {
      method: 'POST',
      body: JSON.stringify({ userId, amount: amountRub, reason, idempotencyKey }),
    });
  },
};

// Quote service
export const quoteApi = {
  async getAllQuotes() {
    return await apiCall('/quotes');
  },

  async viewQuote(userId: string, quoteId: string, liked = false) {
    return await apiCall(`/quotes/${quoteId}/view`, {
      method: 'POST',
      body: JSON.stringify({ userId, liked }),
    });
  },

  async toggleQuoteLike(userId: string, quoteId: string) {
    return await apiCall(`/quotes/${quoteId}/toggle-like`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  async getUserQuoteViews(userId: string, limit = 20) {
    return await apiCall(`/users/${userId}/quotes/views?limit=${limit}`);
  },

  async getUserQuoteStats(userId: string) {
    return await apiCall(`/users/${userId}/quotes/stats`);
  },

  async getUserLikedQuotes(userId: string, limit = 50) {
    return await apiCall(`/users/${userId}/quotes/liked?limit=${limit}`);
  },
};

// User stats service
export const userStatsApi = {
  async getUserStats(userId: string) {
    return await apiCall(`/users/${userId}/stats`);
  },
};

// Subscription service
export const subscriptionApi = {
  async createSubscription(userId: string, plan: string, yookassaPaymentId?: string) {
    return await apiCall('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ userId, plan, yookassaPaymentId }),
    });
  },

  async getUserSubscription(userId: string) {
    return await apiCall(`/users/${userId}/subscription`);
  },

  async getAudioSessionInfo(userId: string) {
    return await apiCall(`/users/${userId}/audio-session-info`);
  },

  async recordAudioSession(userId: string) {
    return await apiCall(`/users/${userId}/record-audio-session`, {
      method: 'POST',
    });
  },

  async getMeditationAccess(userId: string) {
    return await apiCall(`/users/${userId}/meditation-access`);
  },

  async getFreeSessionsInfo(userId: string) {
    return await apiCall(`/users/${userId}/free-sessions`);
  },

  async checkAudioAccess(userId: string) {
    return await apiCall(`/users/${userId}/audio-access`);
  },

  async checkMeditationAccess(userId: string) {
    return await apiCall(`/users/${userId}/meditation-access`);
  },

  async useAudioSession(userId: string) {
    return await apiCall(`/users/${userId}/use-audio-session`, {
      method: 'POST',
    });
  },

  async createFreeTrial(userId: string) {
    return await apiCall(`/users/${userId}/create-free-trial`, {
      method: 'POST',
    });
  },
};

// Memory service - работает с историей диалогов в БД
export const memoryApi = {
  async getMemory(userId: string, type: string): Promise<string> {
    try {
      const response = await apiCall(`/memory/${userId}/${type}`);
      return response.memory || '';
    } catch (error) {
      console.error('Error getting memory:', error);
      return '';
    }
  },

  async setMemory(userId: string, type: string, content: string): Promise<string> {
    // Не используется - память сохраняется через appendMemory
    return content;
  },

  async appendMemory(userId: string, type: string, sessionId: string, userMessage: string, assistantMessage: string): Promise<string> {
    try {
      const response = await apiCall(`/memory/${userId}/${type}/append`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, userMessage, assistantMessage }),
      });
      return response.memory || '';
    } catch (error) {
      console.error('Error appending memory:', error);
      return '';
    }
  },

  async clearMemory(userId: string, type: string): Promise<void> {
    try {
      await apiCall(`/memory/${userId}/${type}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error clearing memory:', error);
    }
  },
};

// User Profile service - структурированная память психолога
export interface UserProfile {
  id: string;
  userId: string;
  personalityTraits?: string;
  communicationStyle?: string;
  currentConcerns?: string;
  emotionalState?: string;
  stressTriggers?: string;
  interests?: string;
  dislikes?: string;
  values?: string;
  workLife?: string;
  relationships?: string;
  family?: string;
  health?: string;
  discussedTopics?: string;
  recurringThemes?: string;
  sessionCount: number;
  lastSessionDate?: number;
  createdAt: number;
  updatedAt: number;
}

export const userProfileApi = {
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await apiCall(`/user-profiles/${userId}`);
    return response.profile;
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const response = await apiCall(`/user-profiles/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.profile;
  },

  async incrementSessionCount(userId: string): Promise<UserProfile> {
    const response = await apiCall(`/user-profiles/${userId}/increment-session`, {
      method: 'POST',
    });
    return response.profile;
  },

  async addDiscussedTopic(userId: string, topic: string): Promise<UserProfile> {
    const response = await apiCall(`/user-profiles/${userId}/add-topic`, {
      method: 'POST',
      body: JSON.stringify({ topic }),
    });
    return response.profile;
  },

  async updateEmotionalState(userId: string, emotionalState: string): Promise<UserProfile> {
    const response = await apiCall(`/user-profiles/${userId}/emotional-state`, {
      method: 'PUT',
      body: JSON.stringify({ emotionalState }),
    });
    return response.profile;
  },

  async updateCurrentConcerns(userId: string, concerns: string): Promise<UserProfile> {
    const response = await apiCall(`/user-profiles/${userId}/concerns`, {
      method: 'PUT',
      body: JSON.stringify({ concerns }),
    });
    return response.profile;
  },
};
