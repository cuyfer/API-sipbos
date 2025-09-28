const fetch = require('node-fetch');

const REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REST_URL || !REST_TOKEN) {
  console.warn("[redis] UPSTASH_REDIS_REST_URL or TOKEN missing. Redis features may not work.");
}

async function redisSet(key, value, ttlSeconds) {
  const url = `${REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}` + (ttlSeconds ? `?EX=${ttlSeconds}` : "");
  return fetch(url, { headers: { Authorization: `Bearer ${REST_TOKEN}` } }).then(r => r.json());
}

async function redisGet(key) {
  const url = `${REST_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${REST_TOKEN}` } }).then(r => r.json());
  if (res && typeof res.result === 'string') {
    try { return JSON.parse(res.result); } catch { return res.result; }
  }
  return null;
}

async function redisPublish(channel, message) {
  const url = `${REST_URL}/publish/${encodeURIComponent(channel)}/${encodeURIComponent(JSON.stringify(message))}`;
  return fetch(url, { headers: { Authorization: `Bearer ${REST_TOKEN}` } }).then(r => r.json());
}

module.exports = { redisSet, redisGet, redisPublish };


