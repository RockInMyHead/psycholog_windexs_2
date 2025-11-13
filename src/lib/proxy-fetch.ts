// Custom fetch with proxy support
export const proxyFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const proxyHost = import.meta.env.REACT_APP_PROXY_HOST;
  const proxyPort = import.meta.env.REACT_APP_PROXY_PORT;
  const proxyUsername = import.meta.env.REACT_APP_PROXY_USERNAME;
  const proxyPassword = import.meta.env.REACT_APP_PROXY_PASSWORD;

  if (!proxyHost || !proxyPort || !proxyUsername || !proxyPassword) {
    console.warn('Proxy configuration missing, falling back to regular fetch');
    return fetch(url, options);
  }

  try {
    // For browser environment, we'll use a different approach
    // Since we can't directly set proxy in browser, we'll use the Vite proxy
    if (typeof window !== 'undefined') {
      // Use Vite proxy for development
      const proxyUrl = url.replace('https://api.openai.com', '/api');
      return fetch(proxyUrl, options);
    }

    // For Node.js environment (if used)
    return fetch(url, options);
  } catch (error) {
    console.error('Proxy fetch error:', error);
    // Fallback to regular fetch
    return fetch(url, options);
  }
};
