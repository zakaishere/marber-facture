#!/usr/bin/env node
// Optional external monitor. Nothing in the application imports or starts this file.
// Requires Node.js 18+. Stop with Ctrl+C. Delete this file to remove it.
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const once = args.includes('--once');
const positional = args.filter(value => value !== '--once');
if (args.includes('--help')) {
  console.log('Usage: node tools/health-monitor.mjs <health-url> [--once]');
  console.log('Or set HEALTH_URL. Optional: HEALTH_INTERVAL_SECONDS (default 300), HEALTH_TIMEOUT_SECONDS (default 60).');
  process.exit(0);
}
let url;
try {
  if (positional.length > 1) throw new Error('Unexpected arguments.');
  url = new URL(positional[0] || process.env.HEALTH_URL);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL.');
} catch {
  console.error('Provide an HTTP(S) health URL without embedded credentials. Example: node tools/health-monitor.mjs https://your-app.onrender.com/health');
  process.exit(1);
}
function seconds(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 86400) {
    console.error(`${name} must be an integer between 1 and 86400.`);
    process.exit(1);
  }
  return value * 1000;
}
const interval = seconds('HEALTH_INTERVAL_SECONDS', 300);
const timeout = seconds('HEALTH_TIMEOUT_SECONDS', 60);
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
// Do not print query parameters, which may contain private monitoring tokens.
console.log(`Monitoring ${url.origin}${url.pathname}${once ? ' once' : ` every ${interval / 1000}s`}. Ctrl+C to stop.`);

while (!shutdown.signal.aborted) {
  const started = Date.now();
  const request = new AbortController();
  const onStop = () => request.abort();
  shutdown.signal.addEventListener('abort', onStop, { once: true });
  const timer = setTimeout(() => request.abort(), timeout);
  let healthy = false;
  try {
    const response = await fetch(url, { signal: request.signal, redirect: 'error', headers: { 'User-Agent': 'MarberFacture-HealthMonitor/1.0' } });
    healthy = response.ok;
    await response.body?.cancel();
    console.log(`[${new Date().toISOString()}] ${healthy ? 'UP' : 'DOWN'} HTTP ${response.status} (${Date.now() - started}ms)`);
  } catch {
    if (shutdown.signal.aborted) break;
    console.error(`[${new Date().toISOString()}] DOWN: connection failed or timed out (${Date.now() - started}ms).`);
  } finally {
    clearTimeout(timer);
    shutdown.signal.removeEventListener('abort', onStop);
  }
  if (once) {
    process.exitCode = healthy ? 0 : 1;
    break;
  }
  // Sequential requests: a slow endpoint never creates overlapping checks.
  try {
    await sleep(Math.max(0, interval - (Date.now() - started)), undefined, { signal: shutdown.signal });
  } catch {
    break;
  }
}
if (shutdown.signal.aborted) console.log('Health monitor stopped.');
