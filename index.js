import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import QRCode from 'qrcode';
import pino from 'pino';
import http from 'http';
import fs from 'fs';
import path from 'path';

process.env.TZ = 'Asia/Dhaka';

const DEFAULT_DATA_ROOT = fs.existsSync('/data') ? '/data' : process.cwd();
const AUTH_DIR = process.env.AUTH_DIR || path.join(DEFAULT_DATA_ROOT, 'auth_info');
const DATA_DIR = process.env.DATA_DIR || path.join(DEFAULT_DATA_ROOT, 'bot_data');
const PORT = Number(process.env.PORT || 3000);
const TARGET_GROUP_ID = process.env.GROUP_ID || ''; // Optional: set a specific group JID.
const BOT_PREFIX = process.env.BOT_PREFIX || '/';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(AUTH_DIR, { recursive: true });

const DATA_FILE = path.join(DATA_DIR, 'bot-data.json');

const DEFAULT_DATA = {
  version: 2,
  groups: {},
  users: {},
  reminders: [],
  quiz: {},
  banned: {}
};

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      ...structuredClone(DEFAULT_DATA),
      ...parsed,
      groups: parsed.groups || {},
      users: parsed.users || {},
      reminders: parsed.reminders || [],
      quiz: parsed.quiz || {},
      banned: parsed.banned || {}
    };
  } catch (error) {
    console.error('❌ Data load failed:', error);
    return structuredClone(DEFAULT_DATA);
  }
}

let data = loadData();
let saveTimer = null;

function saveData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, DATA_FILE);
    } catch (error) {
      console.error('❌ Data save failed:', error);
    }
  }, 250);
}

function ensureGroup(groupId) {
  if (!data.groups[groupId]) {
    data.groups[groupId] = {
      rules: `🌸 Starlight Family Rules

1. সবাইকে সম্মান করুন।
2. অশালীন/অপমানজনক কথা বলা যাবে না।
3. অনুমতি ছাড়া বিজ্ঞাপন বা লিংক শেয়ার করা যাবে না।
4. Spam করা যাবে না।
5. নামাজের সময় group off থাকবে।
6. Admin-এর নির্দেশনা মেনে চলুন।

🤍 সুন্দর পরিবেশ বজায় রাখুন।`,
      warnings: {},
      muted: {},
      stats: {},
      messageCount: 0,
      joinedToday: 0,
      leftToday: 0,
      dayKey: '',
      lastActivityNotice: null,
      settings: {
        antiLink: true,
        antiSpam: true,
        birthday: true,
        dailyQuiz: true,
        silentMember: true
      }
    };
    saveData();
  }

  const g = data.groups[groupId];
  if (!g.warnings) g.warnings = {};
  if (!g.muted) g.muted = {};
  if (!g.stats) g.stats = {};
  if (!g.settings) g.settings = {};
  return g;
}

function resetDailyGroup(g) {
  const today = getLocalDate();
  if (g.dayKey !== today) {
    g.dayKey = today;
    g.messageCount = 0;
    g.joinedToday = 0;
    g.leftToday = 0;
    g.stats = {};
    g.lastActivityNotice = null;
    saveData();
  }
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getLocalDateTime() {
  const now = new Date();
  return `${getLocalDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getDisplayName(msg, fallback = 'Member') {
  return msg?.pushName || fallback;
}

function getSenderJid(msg) {
  return msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || '';
}

function jidNumber(jid = '') {
  return jid.split('@')[0].split(':')[0];
}

function mentionTag(jid = '') {
  return `@${jidNumber(jid)}`;
}

function getText(msg) {
  const m = msg?.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.buttonsResponseMessage?.selectedButtonId ||
    m?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m?.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
}

function parseCommand(text) {
  const clean = text.trim();
  if (!clean.startsWith(BOT_PREFIX)) return null;
  const parts = clean.slice(BOT_PREFIX.length).trim().split(/\s+/);
  const name = (parts.shift() || '').toLowerCase();
  return { name, args: parts, rawArgs: parts.join(' ') };
}

function getMentionedJids(msg) {
  return msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid ||
    msg?.message?.imageMessage?.contextInfo?.mentionedJid ||
    msg?.message?.videoMessage?.contextInfo?.mentionedJid ||
    [];
}

function isGroup(msg) {
  return Boolean(msg?.key?.remoteJid?.endsWith('@g.us'));
}

async function getGroupMeta(sock, groupId) {
  try {
    return await sock.groupMetadata(groupId);
  } catch {
    return null;
  }
}

function sameJid(a = '', b = '') {
  if (!a || !b) return false;
  if (a === b) return true;

  // WhatsApp/Baileys may expose the same account with different device/LID
  // suffixes. Compare the stable numeric portion as a safe fallback.
  return jidNumber(a) === jidNumber(b);
}

async function isAdmin(sock, groupId, jid) {
  const meta = await getGroupMeta(sock, groupId);
  if (!meta || !jid) return false;

  const member = meta.participants.find(p => sameJid(p.id, jid));
  return Boolean(member?.admin || member?.isAdmin);
}

function addJidVariant(list, jid) {
  if (!jid || typeof jid !== 'string') return;
  const clean = jid.trim();
  if (!clean) return;
  if (!list.includes(clean)) list.push(clean);
  const number = jidNumber(clean);
  if (number && !list.includes(number)) list.push(number);
}

async function getBotIdentityJids(sock) {
  const ids = [];
  addJidVariant(ids, sock.user?.id);
  addJidVariant(ids, sock.user?.jid);
  addJidVariant(ids, sock.user?.lid);

  // Baileys can keep the current account in creds.me as well.
  const me = sock.authState?.creds?.me;
  if (me) {
    addJidVariant(ids, me.id);
    addJidVariant(ids, me.lid);
  }

  // On newer WhatsApp sessions the group participant may be a LID while
  // sock.user.id is the phone-number JID. Resolve both directions when the
  // Baileys LID mapper is available.
  const mapper = sock.signalRepository?.lidMapping;
  if (mapper) {
    const snapshot = [...ids];
    for (const jid of snapshot) {
      try {
        if (jid.includes('@lid') && typeof mapper.getPNForLID === 'function') {
          addJidVariant(ids, await mapper.getPNForLID(jid));
        }
        if (jid.includes('@s.whatsapp.net') && typeof mapper.getLIDForPN === 'function') {
          addJidVariant(ids, await mapper.getLIDForPN(jid));
        }
      } catch (_) {}
    }
  }
  return ids;
}

async function botIsAdmin(sock, groupId) {
  const meta = await getGroupMeta(sock, groupId);
  if (!meta?.participants?.length) return false;

  const botJids = await getBotIdentityJids(sock);
  if (!botJids.length) return false;

  return meta.participants.some(member => {
    if (!(member?.admin || member?.isAdmin)) return false;
    const memberIds = [member.id, member.jid, member.lid].filter(Boolean);
    return memberIds.some(memberJid =>
      botJids.some(botJid => sameJid(memberJid, botJid))
    );
  });
}

async function sendText(sock, groupId, text, mentions = []) {
  return sock.sendMessage(groupId, { text, mentions });
}

async function setGroupMode(sock, groupId, action) {
  if (!(await botIsAdmin(sock, groupId))) {
    throw new Error('Agent is not a group admin');
  }
  return sock.groupSettingUpdate(
    groupId,
    action === 'off' ? 'announcement' : 'not_announcement'
  );
}

async function safeRemove(sock, groupId, jids) {
  if (!(await botIsAdmin(sock, groupId))) throw new Error('Bot is not a group admin');
  const clean = [...new Set(jids.filter(Boolean))];
  if (!clean.length) return;
  return sock.groupParticipantsUpdate(groupId, clean, 'remove');
}

function extractUrl(text) {
  return /(https?:\/\/|www\.)\S+/i.test(text);
}

function isCommand(text) {
  return text.trim().startsWith(BOT_PREFIX);
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : '', `${s}s`].filter(Boolean).join(' ');
}

function targetFromMessage(msg) {
  const mentioned = getMentionedJids(msg);
  return mentioned[0] || null;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const schedule = [
  {
    time: '06:00',
    action: 'on',
    message: `𝐆𝐑𝐎𝐔𝐏 𝐎𝐍 🟢

🌷 𝐀𝐬𝐬𝐚𝐥𝐚𝐦𝐮𝐚𝐥𝐚𝐢𝐤𝐮𝐦 𝐄𝐯𝐞𝐫𝐲𝐨𝐧𝐞 🤍

🌅 নতুন সকাল, নতুন শুরু ✨
🌸 ঘুম ভাঙুক সুন্দর এক হাসিতে।

এখন আমাদের প্রিয় গ্রুপটি আবার **ON** করা হলো। 💗

☀️ সবাই উঠে পড়ুন,
আড্ডায় ফিরে আসুন! 🫶🏻

💫 𝐇𝐚𝐯𝐞 𝐚 𝐁𝐥𝐞𝐬𝐬𝐞𝐝 𝐃𝐚𝐲 💫

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },
  { time: '13:20', action: 'off', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায় গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '13:45', action: 'on', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে, এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '16:20', action: 'off', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায় গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '16:45', action: 'on', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে, এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '17:35', action: 'off', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায় গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '18:00', action: 'on', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে, এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '20:20', action: 'off', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায় গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '20:45', action: 'on', message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে, এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` },
  { time: '00:00', action: 'off', message: `─── 🌸🫧🕊️ ───

🔕 𝐆𝐑𝐎𝐔𝐏 𝐎𝐅𝐅 🔕

🌙 রাতের নীরবতা ও আদব বজায় রাখতে গ্রুপটি সাময়িকভাবে Off রাখা হলো। 🕊️

🚫 কোনো মেসেজ/পোস্ট নয়
🤍 শুধু সবর ও দোয়া।

🤲🏻 𝐀𝐥𝐥𝐚𝐡 𝐇𝐚𝐟𝐢𝐳 🤍
🌙💤 𝐆𝐨𝐨𝐝 𝐍𝐢𝐠𝐡𝐭 💤

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️` }
];

const funny = {
  roast: [
    '🔥 আজকের Roast: {name} — আপনার reply speed দেখে Wi‑Fi-ও insecure! 😂',
    '😂 {name}-কে active দেখা গেছে! নিশ্চয়ই আজ group-এ attendance দিতে এসেছেন!',
    '👀 {name}, এত চুপ কেন? Agent আপনাকে suspicious list-এ রাখছে! 😆',
    '🤣 {name} online আছেন, কিন্তু কাজের বেলায় “network problem”!'
  ],
  fortune: [
    '🔮 আজ আপনার ভাগ্য বলছে—আজ group-এ অন্তত ৩ বার “কি খবর?” বলবেন! 😂',
    '🔮 আজ আপনার lucky number 7। আর lucky কাজ হলো group-এ একটু হাসি ছড়ানো! 😄',
    '🔮 আজ আপনার সামনে বড় সুযোগ—কারও message-এ “হুম” reply দেওয়া! 😂'
  ],
  truth: [
    'আপনি group-এ সবচেয়ে বেশি কার message পড়েন?',
    'আপনার সবচেয়ে funny nickname কী?',
    'শেষ কবে group message দেখে reply না দিয়ে চলে গেছেন? 😏',
    'আপনার সবচেয়ে বেশি ব্যবহৃত emoji কোনটি?'
  ],
  dare: [
    'পরের ৫ মিনিট শুধু বাংলা ভাষায় কথা বলুন। 😄',
    'একজন member-কে genuine একটা compliment দিন। 🤍',
    'Group-এ আপনার favourite emoji ১০ বার পাঠান। 😂',
    'একটা clean funny joke বলুন।'
  ]
};

const quizzes = [
  ['বাংলাদেশের রাজধানী কোনটি?', ['A) Sylhet', 'B) Dhaka', 'C) Chittagong', 'D) Rajshahi'], 'b'],
  ['বাংলাদেশের জাতীয় ফুল কোনটি?', ['A) Rose', 'B) Water Lily', 'C) Sunflower', 'D) Jasmine'], 'b'],
  ['এক সপ্তাহে কয় দিন?', ['A) 5', 'B) 6', 'C) 7', 'D) 8'], 'c'],
  ['সূর্য কোন দিকে ওঠে?', ['A) পশ্চিম', 'B) উত্তর', 'C) দক্ষিণ', 'D) পূর্ব'], 'd'],
  ['বাংলাদেশের মুদ্রার নাম কী?', ['A) Rupee', 'B) Taka', 'C) Dollar', 'D) Riyal'], 'b']
];

let currentQR = null;
let botConnected = false;
let scheduleStarted = false;
let lastExecuted = {};
const recentMessages = new Map();

function getDashboardSchedule() {
  return schedule.map(item => ({
    time: item.time,
    action: item.action,
    label: item.action === 'off' ? 'GROUP OFF' : 'GROUP ON'
  }));
}

function getCurrentScheduleState() {
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const points = schedule.map(item => {
    const [h, m] = item.time.split(':').map(Number);
    return { ...item, sec: h * 3600 + m * 60 };
  });
  let current = points[points.length - 1];
  for (const item of points) {
    if (item.sec <= nowSec) current = item;
  }
  return current?.action === 'off' ? 'closed' : 'open';
}

function getNextScheduleItem() {
  const now = new Date();
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const items = getDashboardSchedule().map(item => {
    const [h, m] = item.time.split(':').map(Number);
    return { ...item, sec: h * 3600 + m * 60 };
  });
  const next = items.find(item => item.sec > nowSec) || items[0];
  const until = next.sec > nowSec ? next.sec - nowSec : 86400 - nowSec + next.sec;
  return { time: next.time, action: next.action, label: next.label, secondsUntil: until };
}

const dashboardCommands = [
  ['/help','All commands'],['/profile','Member profile'],['/rules','Group rules'],['/stats','Activity & ranking'],
  ['/quiz','Daily quiz'],['/answer A','Quiz answer'],['/dice','Dice'],['/coin','Coin toss'],['/roast @user','Funny roast'],
  ['/love @user','Love meter'],['/fortune','Fortune'],['/truth','Truth'],['/dare','Dare'],['/remind 10m text','Reminder'],
  ['/notice text','Admin notice'],['/warn @user','Warning'],['/mute @user','Mute'],['/kick @user','Remove'],
  ['/ban @user','Ban'],['/antlink on/off','Anti-link'],['/antispam on/off','Anti-spam'],['/birthday @user DD-MM-YYYY','Birthday']
];

const server = http.createServer((req, res) => {
  if (req.url === '/api/status') {
    const payload = {
      connected: AgentConnected,
      timezone: 'Asia/Dhaka',
      groupState: getCurrentScheduleState(),
      schedule: getDashboardSchedule(),
      next: getNextScheduleItem(),
      prefix: BOT_PREFIX,
      version: '2.1'
    };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate' });
    const qrSection = currentQR
      ? `<div class="qr-panel"><div class="qr-title">CONNECT WHATSAPP</div><div class="qr-sub">WhatsApp → Linked Devices → Link a Device</div><img src="${currentQR}" alt="WhatsApp QR Code"><div class="qr-help">Scan this QR code to connect the Agent.</div></div>`
      : '';
    const scheduleRows = getDashboardSchedule().map((item, i) => `
      <div class="timeline-row ${item.action === 'off' ? 'off' : 'on'}" style="--d:${i * 55}ms">
        <div class="time">${item.time}</div><div class="rail"><i></i></div>
        <div class="event"><b>${item.label}</b><span>${item.action === 'off' ? 'Group members locked' : 'Group open for members'}</span></div>
        <div class="state">${item.action.toUpperCase()}</div>
      </div>`).join('');
    const commandCards = dashboardCommands.map(([cmd,desc]) => `<div class="cmd"><code>${cmd}</code><span>${desc}</span></div>`).join('');
    res.end(`<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#03100a"><meta name="color-scheme" content="dark"><title>Starlight Family • Archer Control</title>
<style>
:root{--bg:#020a06;--glass:rgba(6,28,18,.72);--glass2:rgba(5,19,13,.86);--line:rgba(72,255,194,.2);--cyan:#35f6e1;--green:#37ff72;--yellow:#ffe75a;--red:#ff718d;--muted:#66877c;--white:#effff9}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#020805;color:var(--white);font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}body{overflow-x:hidden;background:radial-gradient(circle at 75% 20%,rgba(0,255,128,.11),transparent 26%),radial-gradient(circle at 30% 70%,rgba(0,255,220,.07),transparent 30%),linear-gradient(145deg,#020704,#04140c 52%,#020704)}button{font:inherit}.app{width:min(1180px,100%);margin:auto;padding:12px 18px 36px}.top{height:66px;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:11px}.brand-icon{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(145deg,#0b5a3b,#21ff7c);color:#00170c;font-size:20px;box-shadow:0 0 30px rgba(33,255,124,.2)}.brand b{font-size:16px;letter-spacing:.7px}.brand small{display:block;color:#628074;font-size:9px;letter-spacing:1.8px;margin-top:3px}.status{display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid var(--line);border-radius:999px;background:rgba(3,19,12,.75);font-size:11px;color:#bce9dc}.status i{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 13px var(--green)}.layout{display:grid;grid-template-columns:1.12fr .88fr;gap:16px}.glass{border:1px solid var(--line);background:linear-gradient(145deg,rgba(7,31,20,.75),rgba(2,12,8,.88));border-radius:30px;box-shadow:0 28px 90px rgba(0,0,0,.45);backdrop-filter:blur(22px);overflow:hidden}.main-card{min-height:660px;padding:24px;position:relative}.tag{color:#6f9c8e;font-size:10px;letter-spacing:2.4px;text-transform:uppercase}.title{font-size:30px;line-height:1.05;margin-top:10px;font-weight:850}.title em{font-style:normal;color:var(--cyan)}.orb-area{height:390px;display:grid;place-items:center;position:relative}.orb{width:330px;height:330px;border-radius:50%;position:relative;border:1px solid rgba(53,246,225,.5);background:radial-gradient(circle at 50% 50%,rgba(0,255,201,.18),transparent 48%),repeating-radial-gradient(circle,rgba(53,246,225,.09) 0 1px,transparent 2px 13px);box-shadow:inset 0 0 60px rgba(53,246,225,.1),0 0 55px rgba(0,255,204,.13);animation:breathe 4.5s ease-in-out infinite}.orb:before,.orb:after{content:"";position:absolute;border-radius:50%;inset:11%;border:1px dashed rgba(53,246,225,.24);animation:spin 13s linear infinite}.orb:after{inset:26%;border-color:rgba(255,231,90,.28);animation-direction:reverse;animation-duration:9s}.core{position:absolute;inset:36%;border-radius:50%;background:radial-gradient(circle,#50ffe5 0,rgba(30,255,187,.24) 34%,transparent 72%);filter:blur(3px);box-shadow:0 0 60px rgba(53,246,225,.4)}.dotp{position:absolute;width:5px;height:5px;border-radius:50%;background:var(--cyan);box-shadow:0 0 12px var(--cyan);animation:float 3.7s ease-in-out infinite}.d1{left:16%;top:34%}.d2{right:16%;top:25%;background:var(--yellow);box-shadow:0 0 12px var(--yellow);animation-delay:.8s}.d3{left:23%;bottom:21%;animation-delay:1.4s}.d4{right:25%;bottom:17%;background:var(--yellow);box-shadow:0 0 12px var(--yellow);animation-delay:2s}.orb-label{position:absolute;bottom:27px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:3px;color:#a9d9ce}.controls{display:flex;align-items:center;justify-content:center;gap:10px}.live-btn{border:1px solid rgba(255,113,141,.6);background:rgba(70,12,25,.25);color:#ff9bad;border-radius:999px;padding:11px 22px;font-size:12px;font-weight:800}.speaker{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:rgba(0,180,210,.12);border:1px solid rgba(53,246,225,.15);color:var(--cyan)}.next{margin-top:18px;padding:15px 17px;border-radius:19px;background:rgba(0,10,7,.52);border:1px solid rgba(53,246,225,.12);display:flex;align-items:center;justify-content:space-between}.next small{display:block;color:#5e7b72;font-size:9px;letter-spacing:1.7px}.next strong{font-size:23px;display:block;margin-top:3px}.next span{font-size:11px;color:var(--cyan)}.next .count{font-size:11px;color:#88a79e;text-align:right}.side{display:grid;gap:16px}.panel{padding:19px}.head{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.head b{font-size:13px;letter-spacing:.9px}.head span{font-size:9px;color:#5e7b72}.timeline{max-height:470px;overflow:auto;padding-right:3px}.timeline-row{display:grid;grid-template-columns:52px 15px 1fr 43px;align-items:center;gap:8px;min-height:49px;padding:5px 5px;border-radius:15px;animation:rise .35s both;animation-delay:var(--d)}.timeline-row:hover{background:rgba(53,246,225,.045)}.time{font-weight:850;font-size:12px}.rail{height:100%;position:relative;display:grid;place-items:center}.rail:before{content:"";position:absolute;top:0;bottom:0;width:1px;background:rgba(53,246,225,.13)}.rail i{z-index:1;width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 10px var(--cyan)}.off .rail i{background:var(--red);box-shadow:0 0 10px var(--red)}.event b{display:block;font-size:10px}.event span{display:block;color:#5e7b72;font-size:8px;margin-top:2px}.state{text-align:center;font-size:8px;font-weight:900;padding:6px 3px;border-radius:8px;color:var(--green);background:rgba(55,255,114,.06);border:1px solid rgba(55,255,114,.12)}.off .state{color:#ff91a5;background:rgba(255,113,141,.06);border-color:rgba(255,113,141,.12)}.commands{display:grid;grid-template-columns:1fr 1fr;gap:7px;max-height:350px;overflow:auto}.cmd{padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:13px;background:rgba(255,255,255,.018)}.cmd code{color:var(--cyan);font:10px ui-monospace,monospace;word-break:break-word}.cmd span{display:block;color:#5e7b72;font-size:8px;margin-top:3px}.footer{text-align:center;color:#38574e;font-size:9px;margin:17px 0}.qr-panel{position:absolute;z-index:20;inset:70px 24px 24px;background:rgba(1,8,5,.97);border:1px solid var(--line);border-radius:26px;padding:20px;text-align:center}.qr-panel img{width:min(290px,82%);background:#fff;padding:9px;border-radius:16px;margin:20px auto}.qr-title{font-size:18px;font-weight:850}.qr-sub,.qr-help{font-size:9px;color:#78978d}@keyframes spin{to{transform:rotate(360deg)}}@keyframes breathe{50%{transform:scale(1.015) translateY(-5px)}}@keyframes float{50%{transform:translate(7px,-9px) scale(1.25)}}@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media(max-width:850px){.layout{grid-template-columns:1fr}.main-card{min-height:620px}.orb-area{height:350px}}@media(max-width:520px){.app{padding:8px 9px 28px}.top{height:58px}.brand b{font-size:14px}.status{font-size:9px;padding:8px 10px}.main-card{padding:18px;min-height:590px;border-radius:24px}.title{font-size:25px}.orb-area{height:315px}.orb{width:255px;height:255px}.orb-label{bottom:24px}.panel{padding:15px;border-radius:22px}.timeline-row{grid-template-columns:48px 12px 1fr 40px}.event span{display:none}.commands{grid-template-columns:1fr 1fr}.cmd{padding:9px}.next strong{font-size:20px}}
</style></head><body><main class="app">
<header class="top"><div class="brand"><div class="brand-icon">✦</div><div><b>ST★RLIGHT FAMILY</b><small>Agent CONTROL CENTER</small></div></div><div class="status"><i id="dot"></i><span id="status">CHECKING...</span></div></header>
<section class="layout"><div class="glass main-card"><div class="tag">WHATSAPP AUTOMATION • LIVE</div><div class="title">Your family group,<br><em>always in control.</em></div>
<div class="orb-area"><div class="orb"><div class="core"></div><i class="dotp d1"></i><i class="dotp d2"></i><i class="dotp d3"></i><i class="dotp d4"></i></div><div class="orb-label">Agent IS LIVE</div></div>
<div class="controls"><div class="live-btn" id="groupState">● LIVE</div><div class="speaker">◉</div></div>
<div class="next"><div><small>NEXT AUTOMATION</small><strong id="nextTime">--:--</strong><span id="nextAction">Loading...</span></div><div class="count" id="count">--</div></div>${qrSection}</div>
<div class="side"><div class="glass panel"><div class="head"><b>TODAY'S AUTOMATION</b><span>ASIA/SYLHET • GMT+6</span></div><div class="timeline">${scheduleRows}</div></div>
<div class="glass panel"><div class="head"><b>COMMAND LIST</b><span>Agent PREFIX ${BOT_PREFIX}</span></div><div class="commands">${commandCards}</div></div></div></section>
<div class="footer">Starlight Family Agent • Rahat Created This Agent</div></main>
<script>
let left=0;function tick(){left=Math.max(0,left-1);let h=Math.floor(left/3600),m=Math.floor(left%3600/60),s=left%60;document.getElementById('count').textContent=(h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
async function refresh(){try{const r=await fetch('/api/status?t='+Date.now(),{cache:'no-store'}),d=await r.json();document.getElementById('status').textContent=d.connected?'WHATSAPP CONNECTED':'WAITING FOR WHATSAPP';document.getElementById('dot').style.background=d.connected?'var(--green)':'var(--yellow)';document.getElementById('groupState').textContent=d.groupState==='closed'?'■ GROUP OFF':'● GROUP ON';document.getElementById('groupState').style.color=d.groupState==='closed'?'var(--red)':'var(--green)';document.getElementById('nextTime').textContent=d.next.time;document.getElementById('nextAction').textContent=d.next.label;left=d.next.secondsUntil;tick()}catch(e){document.getElementById('status').textContent='DASHBOARD ONLINE'}}refresh();setInterval(refresh,10000);setInterval(tick,1000);
</script></body></html>`);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});
server.listen(PORT, '0.0.0.0', () => console.log(`🌐 Health server running on port ${PORT}`));

function allowedGroup(groupId) {
  return !TARGET_GROUP_ID || TARGET_GROUP_ID === groupId;
}

async function getTargetGroups(sock) {
  const groups = await sock.groupFetchAllParticipating();
  const ids = Object.keys(groups).filter(allowedGroup);
  return ids;
}

async function runAutomaticSchedule(sock) {
  try {
    const currentTime = getCurrentTime();
    const today = getLocalDate();
    const items = schedule.filter(item => item.time === currentTime);
    if (!items.length) return;

    const groupIds = await getTargetGroups(sock);
    for (const groupId of groupIds) {
      for (const item of items) {
        const uniqueKey = `${today}_${groupId}_${item.time}_${item.action}`;
        if (lastExecuted[uniqueKey]) continue;
        try {
          if (item.action === 'off' || item.action === 'on') {
            await setGroupMode(sock, groupId, item.action);
          }
          await sendText(sock, groupId, item.message);
          lastExecuted[uniqueKey] = true;
          console.log(`✅ Schedule ${item.time} ${item.action}: ${groupId}`);
        } catch (error) {
          console.error(`❌ Schedule failed for ${groupId}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Schedule checking failed:', error.message);
  }
}

async function processReminders(sock) {
  const now = Date.now();
  const due = data.reminders.filter(r => r.at <= now);
  if (!due.length) return;
  for (const reminder of due) {
    try {
      await sendText(sock, reminder.groupId, `⏰ Reminder for ${mentionTag(reminder.jid)}

${reminder.text}`, [reminder.jid]);
    } catch (error) {
      console.error('❌ Reminder failed:', error.message);
    }
  }
  data.reminders = data.reminders.filter(r => r.at > now);
  saveData();
}

function quizKey(groupId) {
  return `${groupId}_${getLocalDate()}`;
}

async function sendDailyQuiz(sock, groupId) {
  const g = ensureGroup(groupId);
  if (!g.settings.dailyQuiz || data.quiz[quizKey(groupId)]) return;
  const [question, options, answer] = randomItem(quizzes);
  data.quiz[quizKey(groupId)] = { question, options, answer, askedAt: Date.now(), answered: {} };
  saveData();
  await sendText(sock, groupId, `🧠 𝐃𝐚𝐢𝐥𝐲 𝐐𝐮𝐢𝐳

${question}

${options.join('\n')}

উত্তর দিতে লিখুন: /answer A/B/C/D`);
}

async function dailyMaintenance(sock) {
  const groupIds = await getTargetGroups(sock);
  for (const groupId of groupIds) {
    const g = ensureGroup(groupId);
    resetDailyGroup(g);

    // Daily quiz at 10:00 Bangladesh time.
    if (getCurrentTime() === '10:00') {
      const key = `${getLocalDate()}_quiz_sent`;
      if (!data.quiz[key]) {
        data.quiz[key] = { sent: true };
        saveData();
        await sendDailyQuiz(sock, groupId);
      }
    }

    // Daily champion at 23:50.
    if (getCurrentTime() === '23:50' && g.lastActivityNotice !== 'champion') {
      const entries = Object.entries(g.stats).sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
      if (entries.length) {
        const [jid, stat] = entries[0];
        await sendText(sock, groupId, `🏆 𝐓𝐨𝐝𝐚𝐲'𝐬 𝐂𝐡𝐚𝐦𝐩𝐢𝐨𝐧

আজ সবচেয়ে active member:
👑 ${mentionTag(jid)}
💬 Messages: ${stat.messages || 0}

অভিনন্দন! 🎉`, [jid]);
      }
      g.lastActivityNotice = 'champion';
      saveData();
    }
  }
}

async function handleCommand(sock, msg, command) {
  const groupId = msg.key.remoteJid;
  const sender = getSenderJid(msg);
  const g = ensureGroup(groupId);
  const { name, args, rawArgs } = command;
  const mentions = getMentionedJids(msg);
  const admin = await isAdmin(sock, groupId, sender);
  const botAdmin = await botIsAdmin(sock, groupId);

  const adminOnly = async () => {
    if (!admin) {
      await sendText(sock, groupId, '⛔ এই command শুধু Group Admin-দের জন্য।');
      return false;
    }
    return true;
  };

  if (name === 'help' || name === 'commands' || name === 'menu') {
    return sendText(sock, groupId, `🤖 𝐒𝐭𝐚𝐫𝐥𝐢𝐠𝐡𝐭 𝐅𝐚𝐦𝐢𝐥𝐲 Agent

👤 Member Commands
/profile
/rules
/stats
/quiz
/answer A
/dice
/coin
/roast @member
/love @member
/fortune
/truth
/dare
/remind 10m message

🛡️ Admin Commands
ALL ADMIN INBOXES ARE PROVIDED WITH THE ADMIN COMMAND.`);
  }

  if (name === 'off' || name === 'on') {
    if (!(await adminOnly()) || !botAdmin) {
      if (admin && !botAdmin) await sendText(sock, groupId, '⚠️ Agent-কে আগে Group Admin করুন।');
      return;
    }
    try {
      await setGroupMode(sock, groupId, name);
      await sendText(sock, groupId, name === 'off'
        ? '🔒 Group Off\n\nএখন থেকে শুধুমাত্র Admin-রা message পাঠাতে পারবেন।'
        : '🔓 Group Open\n\nএখন সবাই আবার message করতে পারবেন।');
    } catch (e) {
      await sendText(sock, groupId, `❌ কাজটি করা যায়নি: ${e.message}`);
    }
    return;
  }

  if (name === 'profile' || name === 'me') {
    const stat = g.stats[sender] || { messages: 0 };
    const u = data.users[sender] || {};
    return sendText(sock, groupId, `👤 𝐏𝐫𝐨𝐟𝐢𝐥𝐞

নাম: ${getDisplayName(msg)}
📱 Number: ${jidNumber(sender)}
💬 Messages today: ${stat.messages || 0}
🎂 Birthday: ${u.birthday || 'Set করা হয়নি'}

🌸 Starlight Family Member`, [sender]);
  }

  if (name === 'rules') return sendText(sock, groupId, g.rules);

  if (name === 'stats') {
    const entries = Object.entries(g.stats).sort((a, b) => (b[1].messages || 0) - (a[1].messages || 0));
    const top = entries.slice(0, 10).map(([, s], i) => `${i + 1}. ${mentionTag(s.jid)} — ${s.messages || 0}`).join('\n') || 'আজ এখনো কোনো activity নেই।';
    return sendText(sock, groupId, `📊 𝐆𝐫𝐨𝐮𝐩 𝐒𝐭𝐚𝐭𝐬

👥 New joins today: ${g.joinedToday}
👋 Left today: ${g.leftToday}
💬 Total messages today: ${g.messageCount}

🏆 Top Active Members
${top}`, entries.slice(0, 10).map(([jid]) => jid));
  }

  if (name === 'notice') {
    if (!(await adminOnly())) return;
    if (!rawArgs) return sendText(sock, groupId, 'Usage: /notice আপনার notice');
    return sendText(sock, groupId, `📢 𝐈𝐌𝐏𝐎𝐑𝐓𝐀𝐍𝐓 𝐍𝐎𝐓𝐈𝐂𝐄

${rawArgs}

— Starlight Family Admin`);
  }

  if (name === 'warn' || name === 'unwarn' || name === 'warnings') {
    if (!(await adminOnly())) return;
    const target = targetFromMessage(msg);
    if (!target) return sendText(sock, groupId, `Usage: /${name} @member`);
    g.warnings[target] = g.warnings[target] || 0;
    if (name === 'warn') {
      g.warnings[target]++;
      const count = g.warnings[target];
      saveData();
      await sendText(sock, groupId, `⚠️ ${mentionTag(target)}-কে warning দেওয়া হয়েছে।

Warning: ${count}/3`, [target]);
      if (count >= 3 && botAdmin) {
        try {
          await safeRemove(sock, groupId, [target]);
          delete g.warnings[target];
          delete g.muted[target];
          saveData();
          await sendText(sock, groupId, `🚫 ${mentionTag(target)}-কে ৩টি warning পূর্ণ হওয়ায় group থেকে remove করা হয়েছে।`, [target]);
        } catch (e) {
          await sendText(sock, groupId, `⚠️ Remove করা যায়নি: ${e.message}`);
        }
      }
    } else if (name === 'unwarn') {
      delete g.warnings[target];
      saveData();
      await sendText(sock, groupId, `✅ ${mentionTag(target)}-এর warning reset করা হয়েছে।`, [target]);
    } else {
      await sendText(sock, groupId, `⚠️ ${mentionTag(target)}-এর warning: ${g.warnings[target] || 0}/3`, [target]);
    }
    return;
  }

  if (name === 'mute' || name === 'unmute') {
    if (!(await adminOnly())) return;
    const target = targetFromMessage(msg);
    if (!target) return sendText(sock, groupId, `Usage: /${name} @member`);
    if (name === 'mute') {
      g.muted[target] = Date.now();
      saveData();
      return sendText(sock, groupId, `🔇 ${mentionTag(target)}-কে mute করা হয়েছে।\তার message Agent delete করার চেষ্টা করবে।`, [target]);
    }
    delete g.muted[target];
    saveData();
    return sendText(sock, groupId, `🔊 ${mentionTag(target)}-এর mute তুলে নেওয়া হয়েছে।`, [target]);
  }

  if (name === 'kick' || name === 'ban' || name === 'unban') {
    if (!(await adminOnly())) return;
    const target = targetFromMessage(msg);
    if (!target) return sendText(sock, groupId, `Usage: /${name} @member`);
    if (!botAdmin) return sendText(sock, groupId, '⚠️ Agent-কে Group Admin করুন।');

    if (name === 'ban') {
      data.banned[groupId] = data.banned[groupId] || {};
      data.banned[groupId][target] = true;
      saveData();
      try {
        await safeRemove(sock, groupId, [target]);
        return sendText(sock, groupId, `🚫 ${mentionTag(target)}-কে group ban list-এ রাখা হয়েছে এবং remove করা হয়েছে।`, [target]);
      } catch (e) {
        return sendText(sock, groupId, `❌ Ban/remove করা যায়নি: ${e.message}`);
      }
    }

    if (name === 'unban') {
      if (data.banned[groupId]) delete data.banned[groupId][target];
      saveData();
      return sendText(sock, groupId, `✅ ${mentionTag(target)}-এর ban list status removed হয়েছে।\nতবে WhatsApp-এ তাকে আবার add করতে Admin-এর প্রয়োজন হতে পারে।`, [target]);
    }

    try {
      await safeRemove(sock, groupId, [target]);
      await sendText(sock, groupId, `👋 ${mentionTag(target)}-কে group থেকে remove করা হয়েছে।`, [target]);
    } catch (e) {
      await sendText(sock, groupId, `❌ Kick করা যায়নি: ${e.message}`);
    }
    return;
  }

  if (name === 'antlink' || name === 'antispam') {
    if (!(await adminOnly())) return;
    const value = args[0]?.toLowerCase();
    if (!['on', 'off'].includes(value)) return sendText(sock, groupId, `Usage: /${name} on অথবা /${name} off`);
    const key = name === 'antlink' ? 'antiLink' : 'antiSpam';
    g.settings[key] = value === 'on';
    saveData();
    return sendText(sock, groupId, `✅ ${name === 'antlink' ? 'Anti-Link' : 'Anti-Spam'} ${value === 'on' ? 'ON' : 'OFF'} করা হয়েছে।`);
  }

  if (name === 'setrules') {
    if (!(await adminOnly())) return;
    if (!rawArgs) return sendText(sock, groupId, 'Usage: /setrules আপনার group rules');
    g.rules = rawArgs;
    saveData();
    return sendText(sock, groupId, '✅ Group rules update করা হয়েছে।');
  }

  if (name === 'birthday') {
    if (!(await adminOnly())) return;
    const target = targetFromMessage(msg);
    const date = args.find(a => /^\d{2}-\d{2}-\d{4}$/.test(a));
    if (!target || !date) return sendText(sock, groupId, 'Usage: /birthday @member DD-MM-YYYY');
    data.users[target] = data.users[target] || {};
    data.users[target].birthday = date;
    saveData();
    return sendText(sock, groupId, `🎂 ${mentionTag(target)}-এর birthday ${date} হিসেবে save করা হয়েছে।`, [target]);
  }

  if (name === 'birthdaylist') {
    const list = Object.entries(data.users).filter(([, u]) => u.birthday).map(([jid, u]) => `${mentionTag(jid)} — ${u.birthday}`).join('\n');
    return sendText(sock, groupId, `🎂 𝐁𝐢𝐫𝐭𝐡𝐝𝐚𝐲 𝐋𝐢𝐬𝐭\n\n${list || 'কোনো birthday set করা হয়নি।'}`);
  }

  if (name === 'remind') {
    const m = rawArgs.match(/^(\d+)(s|m|h|d)\s+(.+)$/i);
    if (!m) return sendText(sock, groupId, 'Usage: /remind 10m আপনার reminder');
    const amount = Number(m[1]);
    const unit = m[2].toLowerCase();
    const multiplier = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
    const at = Date.now() + amount * multiplier;
    data.reminders.push({ id: `${Date.now()}_${Math.random()}`, groupId, jid: sender, at, text: m[3] });
    saveData();
    return sendText(sock, groupId, `⏰ Reminder set করা হয়েছে!\n\nসময়: ${amount}${unit}\n📝 ${m[3]}`, [sender]);
  }

  if (name === 'quiz') {
    await sendDailyQuiz(sock, groupId);
    return;
  }

  if (name === 'answer') {
    const q = data.quiz[quizKey(groupId)];
    const ans = (args[0] || '').toLowerCase();
    if (!q?.question) return sendText(sock, groupId, 'আজকের quiz এখনো তৈরি হয়নি। /quiz লিখে শুরু করুন।');
    if (!['a', 'b', 'c', 'd'].includes(ans)) return sendText(sock, groupId, 'উত্তর দিন: /answer A/B/C/D');
    q.answered = q.answered || {};
    if (q.answered[sender]) return sendText(sock, groupId, 'আপনি আজকের quiz-এর উত্তর ইতিমধ্যে দিয়েছেন।');
    q.answered[sender] = ans;
    saveData();
    return sendText(sock, groupId, ans === q.answer
      ? `🎉 Correct! ${mentionTag(sender)} আপনি সঠিক উত্তর দিয়েছেন!`
      : `❌ Wrong! ${mentionTag(sender)} সঠিক উত্তরটি ছিল ${q.answer.toUpperCase()}।`, [sender]);
  }

  if (name === 'dice') return sendText(sock, groupId, `🎲 Dice: **${Math.floor(Math.random() * 6) + 1}**`);
  if (name === 'coin') return sendText(sock, groupId, `🪙 Coin Toss: **${Math.random() < 0.5 ? 'HEAD' : 'TAIL'}**`);

  if (name === 'roast') {
    const target = targetFromMessage(msg) || sender;
    return sendText(sock, groupId, randomItem(funny.roast).replace('{name}', mentionTag(target)), [target]);
  }

  if (name === 'fortune') return sendText(sock, groupId, `🔮 ${randomItem(funny.fortune)}`);
  if (name === 'truth') return sendText(sock, groupId, `🎯 𝐓𝐑𝐔𝐓𝐇\n\n${randomItem(funny.truth)}`);
  if (name === 'dare') return sendText(sock, groupId, `🔥 𝐃𝐀𝐑𝐄\n\n${randomItem(funny.dare)}`);

  if (name === 'love') {
    const target = targetFromMessage(msg) || sender;
    const percent = Math.floor(Math.random() * 101);
    return sendText(sock, groupId, `❤️ 𝐋𝐨𝐯𝐞 𝐌𝐞𝐭𝐞𝐫

${mentionTag(sender)} ❤️ ${mentionTag(target)}

Compatibility: **${percent}%** 😄`, [sender, target]);
  }

  return sendText(sock, groupId, `❓ Unknown command: ${BOT_PREFIX}${name}\n\n${BOT_PREFIX}help লিখে সব command দেখুন।`);
}

async function handleIncomingMessage(sock, msg) {
  if (!isGroup(msg) || !msg.message) return;
  const groupId = msg.key.remoteJid;
  if (!allowedGroup(groupId)) return;

  const g = ensureGroup(groupId);
  resetDailyGroup(g);

  const sender = getSenderJid(msg);
  if (!sender) return;

  const text = getText(msg);
  const command = parseCommand(text);

  // Mute system: delete messages from muted users when bot has admin rights.
  if (g.muted[sender] && !command) {
    try {
      if (await botIsAdmin(sock, groupId)) {
        await sock.sendMessage(groupId, { delete: msg.key });
      }
    } catch (error) {
      console.error('❌ Muted message delete failed:', error.message);
    }
    return;
  }

  // Track statistics.
  g.messageCount++;
  g.stats[sender] = g.stats[sender] || { messages: 0, jid: sender, name: getDisplayName(msg) };
  g.stats[sender].messages++;
  g.stats[sender].name = getDisplayName(msg);
  g.stats[sender].jid = sender;

  // Anti-spam: 6+ messages in 8 seconds -> warning and optional mute for 60 sec.
  if (g.settings.antiSpam && !command) {
    const now = Date.now();
    const arr = recentMessages.get(`${groupId}:${sender}`) || [];
    arr.push(now);
    while (arr.length && now - arr[0] > 8000) arr.shift();
    recentMessages.set(`${groupId}:${sender}`, arr);
    if (arr.length >= 6 && !(await isAdmin(sock, groupId, sender))) {
      g.warnings[sender] = (g.warnings[sender] || 0) + 1;
      g.muted[sender] = Date.now();
      setTimeout(() => {
        if (g.muted[sender] && Date.now() - g.muted[sender] >= 55000) {
          delete g.muted[sender];
          saveData();
        }
      }, 60000);
      saveData();
      await sendText(sock, groupId, `🚨 Anti-Spam Alert\n\n${mentionTag(sender)} খুব দ্রুত message পাঠাচ্ছেন।\n⚠️ Warning: ${g.warnings[sender]}/3\n🔇 ১ মিনিটের জন্য auto-mute করা হয়েছে।`, [sender]);
      recentMessages.set(`${groupId}:${sender}`, []);
    }
  }

  // Anti-link.
  if (g.settings.antiLink && extractUrl(text) && !command && !(await isAdmin(sock, groupId, sender))) {
    try {
      if (await botIsAdmin(sock, groupId)) {
        await sock.sendMessage(groupId, { delete: msg.key });
        await sendText(sock, groupId, `🚫 ${mentionTag(sender)} অনুমতি ছাড়া link শেয়ার করা যাবে না।`, [sender]);
      }
    } catch (error) {
      console.error('❌ Anti-link action failed:', error.message);
    }
    saveData();
    return;
  }

  saveData();

  if (command) {
    try {
      await handleCommand(sock, msg, command);
    } catch (error) {
      console.error(`❌ Command /${command.name} failed:`, error);
      await sendText(sock, groupId, `❌ Commandটি চালানো যায়নি।\nকারণ: ${error.message || 'Unknown error'}`);
    }
  }
}

async function checkBirthday(sock, groupId) {
  const g = ensureGroup(groupId);
  if (!g.settings.birthday) return;
  const today = getLocalDate().slice(5).replace('-', '-'); // MM-DD
  const meta = await getGroupMeta(sock, groupId);
  if (!meta) return;

  for (const jid of meta.participants.map(p => p.id)) {
    const birthday = data.users[jid]?.birthday;
    if (!birthday) continue;
    const [dd, mm] = birthday.split('-');
    if (`${mm}-${dd}` === today) {
      const key = `${getLocalDate()}_birthday_${jid}`;
      if (!data.quiz[key]) {
        data.quiz[key] = { sent: true };
        saveData();
        await sendText(sock, groupId, `🎉🎂 𝐇𝐚𝐩𝐩𝐲 𝐁𝐢𝐫𝐭𝐡𝐝𝐚𝐲!

আজ আমাদের প্রিয় ${mentionTag(jid)}-এর Birthday! ❤️

আল্লাহ আপনার জীবন সুখী, সুন্দর ও বরকতময় করুন। 🤲🏻🌸

সবাই birthday wish করে আসুন! 🎉`, [jid]);
      }
    }
  }
}

async function handleParticipants(sock, event) {
  if (!allowedGroup(event.id)) return;
  const g = ensureGroup(event.id);

  if (event.action === 'add') {
    g.joinedToday += event.participants.length;
    saveData();

    for (const participant of event.participants) {
      if (data.banned[event.id]?.[participant]) {
        try {
          if (await botIsAdmin(sock, event.id)) await safeRemove(sock, event.id, [participant]);
        } catch (e) {
          console.error('❌ Banned user removal failed:', e.message);
        }
        continue;
      }

      const number = jidNumber(participant);
      await sendText(sock, event.id, `🌸 আসসালামু আলাইকুম @${number}

Starlight Family-তে তোমাকে আন্তরিকভাবে স্বাগতম। 🤍

আশা করি আমাদের Family-এর সাথে তোমার সময়টা সুন্দর কাটবে।

সবাই মিলে সুন্দরভাবে আড্ডা দিই এবং একে অপরকে সম্মান করি। 🌸

📌 Group Rules দেখতে /rules লিখুন।
🤖 Agent Commands দেখতে /help লিখুন।`, [participant]);
    }
  }

  if (event.action === 'remove') {
    g.leftToday += event.participants.length;
    saveData();
    for (const participant of event.participants) {
      await sendText(sock, event.id, `👋 ${mentionTag(participant)} group থেকে চলে গেছেন।\আশা করি আবার দেখা হবে! 🤍`, [participant]);
    }
  }
}

async function startBot() {
  console.log(`\n🔐 Auth directory: ${AUTH_DIR}\n`);
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      try {
        currentQR = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
        console.log('\n📱 NEW WHATSAPP QR GENERATED\n');
      } catch (error) {
        console.error('❌ QR generation failed:', error.message);
      }
    }

    if (connection === 'open') {
      botConnected = true;
      currentQR = null;
      scheduleStarted = true;
      console.log('\n=================================');
      console.log('✅ WhatsApp Agent Connected!');
      console.log('=================================\n');
      console.log('🇧🇩 Timezone: Asia/Dhaka');
      console.log('🤖 Features: Welcome, Schedule, Admin, Anti-Link, Anti-Spam, Stats, Birthday, Reminder, Quiz & Fun');
    }

    if (connection === 'close') {
      botConnected = false;
      currentQR = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('❌ WhatsApp connection closed. Status:', statusCode);

      if (shouldReconnect) {
        scheduleStarted = false;
        setTimeout(() => startBot(), 5000);
      } else {
        console.log('⚠️ WhatsApp logged out. Scan a new QR after restarting.');
      }
    }
  });

  sock.ev.on('group-participants.update', event => handleParticipants(sock, event).catch(e => console.error('❌ Participant event failed:', e.message)));
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        await handleIncomingMessage(sock, msg);
      } catch (error) {
        console.error('❌ Message handler failed:', error);
      }
    }
  });

  setInterval(async () => {
    if (!scheduleStarted) return;
    await runAutomaticSchedule(sock);
    await processReminders(sock);
    try {
      const groupIds = await getTargetGroups(sock);
      for (const groupId of groupIds) {
        await dailyMaintenance(sock);
        if (getCurrentTime() === '00:05') await checkBirthday(sock, groupId);
      }
    } catch (e) {
      console.error('❌ Daily maintenance failed:', e.message);
    }
  }, 30 * 1000);
}

startBot().catch(error => console.error('❌ Bot startup failed:', error));
