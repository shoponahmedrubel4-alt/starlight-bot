# Starlight Family Bot — Bengali Liquid Glass Edition

Node.js + Baileys WhatsApp group-management bot with a Bengali liquid-glass admin panel, dynamic prayer-time schedule, editable custom commands, and optional ElevenLabs voice replies.

> Important: Baileys is an unofficial WhatsApp Web library. WhatsApp may change behavior or restrict sessions. This project does **not** join WhatsApp group voice calls; it supports voice-note replies only. Live group-call AI needs a separate supported integration/voice room.

## Included

- Bengali welcome/goodbye, morning and night notices.
- Prayer times fetched daily from AlAdhan using the configured location/method.
- At each configured prayer time, the bot attempts to close the group immediately (scheduler checks every 5 seconds). It reopens after `PRAYER_HOLD_MINUTES`, unless a later prayer-time closure takes over.
- Admin panel at `/admin`, protected by `ADMIN_PASSWORD`.
- QR code is visible only inside the authenticated admin panel.
- Admin can open/close all allowed groups and create/edit/delete custom text commands.
- Custom command response placeholders: `{name}`, `{group}`, `{mention}`.
- Optional `/voice <text>`: make an ElevenLabs audio message.
- Optional `/ask <question>`: generate an AI answer and send text + audio.
- Optional incoming voice-note auto-reply, enabled per group by an admin with `/voice on`; disable with `/voice off`.
- Existing group tools and entertainment commands are retained.

## Requirements

- Node.js 20+ (Node.js 22 recommended).
- A WhatsApp account to link the bot as a linked device.
- Bot should be a group admin if you want it to change group settings, delete messages, mute/kick/ban members.
- Internet access for the prayer-time endpoint and optional AI/voice APIs.

## Setup

1. Upload/extract the ZIP on a Node.js host (VPS, Render-like service, or a container host). A static PHP host such as InfinityFree cannot run this Node.js bot.
2. Copy `.env.example` to `.env`.
3. Set `ADMIN_PASSWORD` to a long unique password. Never publish `.env` or put API keys into browser code.
4. If you only want one group, set `GROUP_ID` to that group's JID; otherwise leave it blank to target all groups the bot joins.
5. Install and start:

   ```bash
   npm install
   npm start
   ```

6. Open `http://YOUR_HOST:3000/admin` (or your hosting URL with `/admin`), log in with `ADMIN_PASSWORD`, then scan the QR shown in the panel using WhatsApp → Linked devices → Link a device.
7. Keep the process running. Use a process manager or host's persistent service option so it can restart after crashes.

## Prayer schedule settings

- Default location is Dhaka (`23.8103, 90.4125`). Change `PRAYER_LATITUDE` and `PRAYER_LONGITUDE` for your location.
- `PRAYER_CALC_METHOD=1` is the AlAdhan calculation method used by default. Verify the displayed times against the local mosque/calendar and change the method if needed.
- `PRAYER_HOLD_MINUTES=25` means the group is reopened after a 25-minute prayer break. Change this to suit the group.
- Timing accuracy depends on API availability, server uptime, and the scheduler's 5-second polling interval. It is not a hard real-time guarantee. If the prayer-time API is down on first startup, prayer schedule refresh will retry later; confirm the admin panel schedule before relying on it.
- WhatsApp group setting changes can fail if the bot is not an admin or WhatsApp rejects the request. Check logs.

## Voice setup (optional)

1. Create an ElevenLabs account and create/copy an API key.
2. Choose a voice in ElevenLabs and copy its **Voice ID**. Use a voice you are permitted to use; do not impersonate a real person without permission.
3. Put these values in `.env`:

   ```env
   ELEVENLABS_API_KEY=your_elevenlabs_api_key
   ELEVENLABS_VOICE_ID=your_selected_voice_id
   ELEVENLABS_MODEL_ID=eleven_multilingual_v2
   ELEVENLABS_STT_MODEL_ID=scribe_v1
   ```

4. For AI-generated replies, also set:

   ```env
   OPENAI_API_KEY=your_ai_provider_api_key
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_MODEL=gpt-4o-mini
   ```

   If using another OpenAI-compatible provider, update `OPENAI_BASE_URL` and `OPENAI_MODEL` accordingly.
5. Restart the bot after changing `.env`.
6. Test `/voice সুপ্রভাত, স্টারলাইট পরিবার!` in the group. Test `/ask বাংলাদেশ সম্পর্কে কয়েকটি কথা বলো` for an AI answer plus voice.
7. To enable auto-replies to members' incoming voice notes, a group admin runs `/voice on`. Disable with `/voice off`. This sends voice audio to external APIs; inform group members first. API charges and quotas may apply.

## Admin panel / custom commands

- Visit `/admin` and log in.
- Use the custom-command form to create a command such as `rulesinfo`, a short description, and the response text.
- Members can invoke it with `/rulesinfo`.
- Supported placeholders in response: `{name}`, `{group}`, `{mention}`.
- Built-in command names cannot be overwritten.
- Use HTTPS in production. If the app is behind HTTPS, set `COOKIE_SECURE=true`.
- Use a unique admin password and keep `.env` private. The panel has login protection, but it should still be deployed behind HTTPS and ideally a host-level access policy.

## Data and backup

- WhatsApp session files are in `auth_info/` (or `AUTH_DIR`). Treat them like passwords.
- Bot data is in `bot_data/bot-data.json` (or `DATA_DIR`). Back it up securely.
- Never share session files, API keys, or a live QR code publicly.

## Current limitation

This version can send WhatsApp audio/voice notes and can transcribe incoming voice notes when enabled. It cannot reliably join a native WhatsApp group voice call and stream two-way audio through Baileys. The admin panel is a protected lightweight control center, not a full multi-role enterprise panel.
