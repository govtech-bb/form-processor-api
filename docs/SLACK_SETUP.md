# Slack Error Notifications Setup

This document explains how to configure the Slack bot for error reporting in the Forms Processor API.

## Overview

The `SlackService` sends error notifications to a Slack channel whenever a processor fails (payment, email, OpenCRVS, etc.). It uses the Slack Web API `chat.postMessage` endpoint with a bot token — no webhooks required.

Notifications are fire-and-forget: a Slack failure will never affect form processing.

## Required Environment Variables

| Variable             | Description                                        | Example               |
| -------------------- | -------------------------------------------------- | --------------------- |
| `SLACK_BOT_TOKEN`    | Bot OAuth token from your Slack app                | `xoxb-...`            |
| `SLACK_ERROR_CHANNEL`| Channel ID or name to post errors to               | `#errors` or `C12345` |

Both variables must be set for notifications to be sent. If either is missing, the service silently does nothing.

---

## Creating the Slack App

### 1. Create a new Slack app

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Enter an app name (e.g. `Forms Processor Alerts`) and select your workspace
5. Click **Create App**

### 2. Add bot token scopes

1. In the left sidebar, go to **OAuth & Permissions**
2. Scroll down to **Scopes → Bot Token Scopes**
3. Click **Add an OAuth Scope** and add:
   - `chat:write` — required to post messages
   - `chat:write.public` — allows posting to public channels without the bot being a member (optional, see note below)

> **Note:** If you don't add `chat:write.public`, you must invite the bot to the channel manually before it can post (see step 5).

### 3. Install the app to your workspace

1. Scroll back up to **OAuth Tokens for Your Workspace**
2. Click **Install to Workspace**
3. Review the permissions and click **Allow**
4. Copy the **Bot User OAuth Token** — it starts with `xoxb-`

### 4. Set the environment variables

Add the following to your `.env.local` or deployment secrets:

```env
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_ERROR_CHANNEL=#errors
```

You can also use a channel ID instead of a name (more reliable if the channel is ever renamed):

```env
SLACK_ERROR_CHANNEL=C0123456789
```

To find a channel ID: right-click the channel in Slack → **View channel details** → copy the ID at the bottom.

### 5. Invite the bot to the channel

If you did **not** add the `chat:write.public` scope, you must invite the bot:

1. Open the target channel in Slack
2. Type `/invite @Forms Processor Alerts` (or whatever you named the bot)
3. Press Enter

---

## What Gets Reported

Errors are reported in two cases:

### Processor exceptions (email, OpenCRVS, etc.)

Any processor that throws an unhandled exception is caught by `ProcessorPipelineService` and reported automatically. The notification includes:

- Processor type
- Form ID
- Submission ID
- Error message

### Payment service failures (EZPay)

When EZPay returns a non-success response (e.g. HTTP 403, invalid API key), the `PaymentProcessor` reports it directly. The notification additionally includes:

- Payment amount
- Payment description

---

## Example Notification

```
🔴  Payment Service Error
─────────────────────────
Error:
Payment creation failed: HTTP 403: Forbidden

Processor: payment     Form: get-birth-certificate
Amount: 10             Submission: GBC-20260225-200715-43ZWFU
Description: Birth Certificate Processing Fee (per copy)
```

---

## Rotating or Revoking the Token

If the bot token is compromised:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → your app → **OAuth & Permissions**
2. Click **Revoke Token** next to the current bot token
3. Reinstall the app to generate a new token
4. Update `SLACK_BOT_TOKEN` in your deployment secrets

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No messages appearing | Token or channel not set | Verify both env vars are set and the server restarted |
| `channel_not_found` in logs | Wrong channel name/ID | Double-check `SLACK_ERROR_CHANNEL`; try using the channel ID instead |
| `not_in_channel` in logs | Bot not invited | `/invite @YourBotName` in the channel, or add `chat:write.public` scope |
| `invalid_auth` in logs | Token revoked or wrong | Generate a new token and update the env var |

Slack API errors are logged at `WARN` level and never surface to the API consumer.
