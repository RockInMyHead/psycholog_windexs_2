const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors({
  origin: ['https://psycholog.windexs.ru'],
  credentials: true
}));

// Proxy configuration
const proxyHost = process.env.REACT_APP_PROXY_HOST || '185.68.187.20';
const proxyPort = process.env.REACT_APP_PROXY_PORT || '8000';
const proxyUsername = process.env.REACT_APP_PROXY_USERNAME || 'rBD9e6';
const proxyPassword = process.env.REACT_APP_PROXY_PASSWORD || 'jZdUnJ';

const proxyUrl = `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
const agent = new HttpsProxyAgent(proxyUrl);

console.log('Using proxy:', proxyUrl);

// Proxy OpenAI API requests
app.use('/api', createProxyMiddleware({
  target: 'https://api.openai.com',
  changeOrigin: true,
  secure: true,
  agent: agent,
  pathRewrite: {
    '^/api': '' // Remove /api prefix when forwarding to OpenAI
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('[PROXY] Forwarding:', req.method, req.path, '-> https://api.openai.com' + req.path);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('[PROXY] Response status:', proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error('[PROXY] Error:', err.message);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
}));

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
