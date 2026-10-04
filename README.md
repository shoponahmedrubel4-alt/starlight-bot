# Starlight Family WhatsApp Bot v2

এই version-এ আগের automation রেখে group management, security, member utility, statistics, reminders, birthday, quiz এবং fun commands যোগ করা হয়েছে।

## Existing automation

- 06:00 — Group ON + Good Morning
- 13:15 — Group OFF
- 13:45 — Group ON
- 16:45 — Group OFF
- 17:15 — Group ON
- 18:45 — Group OFF
- 19:15 — Group ON
- 20:00 — Group OFF
- 20:30 — Group ON
- 00:00 — Group OFF + Good Night

Times are Asia/Dhaka and can be edited in `index.js`.

## Important

For `/off`, `/on`, anti-link deletion, mute deletion, kick/ban এবং scheduled group lock/unlock, the WhatsApp bot account must be a **Group Admin**.

## Commands

### Member
- `/help` — all commands
- `/profile` — own profile
- `/rules` — group rules
- `/stats` — daily activity statistics
- `/quiz` — daily quiz
- `/answer A` — answer quiz
- `/dice` — dice
- `/coin` — coin toss
- `/roast @member` — harmless roast
- `/love @member` — fun love meter
- `/fortune` — fun fortune
- `/truth` — truth question
- `/dare` — dare
- `/remind 10m message` — reminder (s/m/h/d)

### Admin
- `/off` — lock group
- `/on` — open group
- `/notice message` — notice
- `/warn @member` — warning; 3 warnings attempts removal
- `/warnings @member` — check warnings
- `/unwarn @member` — reset warning
- `/mute @member` — auto-delete that member's messages
- `/unmute @member` — remove mute
- `/kick @member` — remove member
- `/ban @member` — add to bot ban list and remove
- `/unban @member` — remove bot ban-list entry
- `/antlink on|off` — anti-link
- `/antispam on|off` — anti-spam
- `/setrules text` — replace group rules
- `/birthday @member DD-MM-YYYY` — set birthday
- `/birthdaylist` — show saved birthdays

## Automatic features

### Welcome
New members are mentioned automatically with a welcome message and `/rules` + `/help` hint.

### Goodbye
Members leaving are announced automatically.

### Anti-link
Non-admin members' messages containing URLs are deleted when the bot is admin.

### Anti-spam
6 or more messages from one non-admin within roughly 8 seconds triggers a warning and a short automatic mute.

### Warning
Three warnings trigger a removal attempt.

### Mute
WhatsApp does not expose a normal per-user "mute" setting for group members. This bot implements mute by deleting messages from muted members while the bot is admin.

### Birthday
Birthday data is stored persistently in `bot-data.json`. The bot checks saved birthdays around 00:05.

### Reminder
Reminders are persisted, so a restart does not intentionally discard them. Use `/remind 10m your message`.

### Daily quiz
A daily quiz is scheduled around 10:00 and can also be started manually with `/quiz`.

### Daily champion
At 23:50 the bot announces the most active member of the day.

## Persistent storage

The bot creates:
- `AUTH_DIR` — WhatsApp login/session
- `DATA_DIR/bot-data.json` — warnings, mutes, birthdays, reminders, stats, settings, ban list, quiz data

Do not delete these folders unless you intentionally want to reset login/data.

## Target group

By default the bot can work in all groups where it is a member. For a single group, set:

`GROUP_ID=YOUR_GROUP_JID@g.us`

Then restart the bot.

## Notes

The prayer ON/OFF times are the same fixed times already used by the previous bot. They are not dynamically calculated from daily prayer times. If prayer times change seasonally, update the `schedule` section in `index.js`.

## Web Dashboard
The root URL now shows a live Starlight Family control dashboard with a glowing animated orb, WhatsApp connection status, next automation countdown, full daily schedule, and command list. The bot automation logic remains in `index.js`.

### Current Bangladesh schedule
- 06:00 — Group ON
- 13:20 — Group OFF
- 13:45 — Group ON
- 16:20 — Group OFF
- 16:45 — Group ON
- 17:35 — Group OFF
- 18:00 — Group ON
- 20:20 — Group OFF
- 20:45 — Group ON
- 00:00 — Group OFF
