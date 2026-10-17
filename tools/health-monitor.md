# Optional deployment health monitor

The application already exposes `GET /health` without login:

- HTTP 200, `status: ok`: application and database respond.
- HTTP 503, `status: error`: database connection failed.
- `GET /ping` checks only that the application is alive.

## Automatic backend checks (default)

Starting the backend now checks its own `/health` immediately after startup and
again every 300 seconds. Logs show `Health ping UP` or `Health ping DOWN`.
Failures do not stop the backend or future checks. Requests never overlap.

To check a public or external URL instead, set this environment variable in Render
and redeploy (or set it in your local shell before starting the backend):

```dotenv
APP_HEALTH_PING_URL=https://YOUR-SERVICE.onrender.com/health
```

With no URL configured, the backend uses its actual local listening port.
Optional settings:

```dotenv
APP_HEALTH_PING_ENABLED=false
APP_HEALTH_PING_INTERVAL_SECONDS=300
APP_HEALTH_PING_TIMEOUT_SECONDS=60
```

`APP_HEALTH_PING_ENABLED=false` disables automatic checks; the other values are the
default interval and request timeout. Do not set `false` when you want checks enabled.
The component is independent: remove
`backend/src/main/java/com/stock/management/ops/HealthPingMonitor.java` to remove
all automatic checks without changing `/health` or invoice code.

The backend cannot monitor itself when it is stopped or suspended. Use the external
script below on a separate running computer for independent deployment monitoring.

## Run the separate external monitor

Install Node.js 18 or newer. From the repository root:

```powershell
node tools/health-monitor.mjs https://YOUR-SERVICE.onrender.com/health
```

The script checks immediately, then every five minutes. It prints a timestamp,
UP/DOWN, the HTTP status when available, and request duration. Connection failures
do not stop the loop. Requests time out after 60 seconds and never overlap.
Use the final HTTPS URL: redirects are reported as failures.

One check only (exit code 0 for success, 1 for failure):

```powershell
node tools/health-monitor.mjs https://YOUR-SERVICE.onrender.com/health --once
```

Local check:

```powershell
node tools/health-monitor.mjs http://127.0.0.1:4000/health --once
```

You can supply the URL through `HEALTH_URL` instead of an argument. Optional
`HEALTH_INTERVAL_SECONDS` and `HEALTH_TIMEOUT_SECONDS` change the interval and timeout.

Keep the script running on a separate computer or monitoring host. It stops when
you close its terminal or the computer sleeps. It is not started by Spring Boot,
Docker, or Render, and it does not send email/phone notifications. A successful
health check confirms connectivity; it does not test invoice or PDF workflows.

Stop with Ctrl+C. To remove the monitor, delete `tools/health-monitor.mjs` and this
file; the application and its `/health` endpoint continue working.

For Render's built-in service health check, use `/health` as the health check path.
