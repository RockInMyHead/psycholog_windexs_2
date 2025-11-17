// API service for client-side communication with server
const API_FALLBACK_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_ORIGIN) ||
  'https://psycholog.windexs.ru';

// Always use relative paths when in browser - Vite proxy will handle it
const isDevelopment = typeof window !== 'undefined';

// Debug logs for development
if (typeof window !== 'undefined') {
  console.log('API Service: Using local proxy for API calls');
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
    const response = await fetch(url, config);
    if (!response.ok) {
      const error: any = new Error(
        `API call failed: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      error.statusText = response.statusText;
      error.body = await response.text().catch(() => undefined);
      throw error;
    }
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
}

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
    } catch (error: any) {
      if (error?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async updateUser(userId: string, data: any) {
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
};

// Memory service - for now, this is a simple implementation
export const memoryApi = {
  async getMemory(userId: string, type: string) {
    // Memory is derived from chat messages, so we don't store it separately
    return '';
  },

  async setMemory(userId: string, type: string, content: string) {
    // For now, memory is not persistently stored
    return content;
  },

  async appendMemory(userId: string, type: string, entry: string, maxLength = 2000) {
    // For now, memory is not persistently stored
    return entry;
  },

  async clearMemory(userId: string, type: string) {
    // For now, memory is not persistently stored
  },
};
