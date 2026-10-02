import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import QRCode from 'qrcode';
import pino from 'pino';
import http from 'http';


// ======================================================
// ⚙️ SETTINGS
// ======================================================

process.env.TZ = 'Asia/Dhaka';

// Deplexo-তে /data persistent storage ব্যবহার করবে
// Local computer-এ ./auth_info ব্যবহার করবে
const AUTH_DIR =
  process.env.AUTH_DIR || '/data/auth_info';


// ======================================================
// 🌐 HEALTH SERVER
// ======================================================

const PORT = Number(
  process.env.PORT || 3000
);

let currentQR = null;
let botConnected = false;

const server = http.createServer(
  async (req, res) => {

    // ==========================
    // HEALTH CHECK
    // ==========================

    if (
      req.url === '/' ||
      req.url === '/health'
    ) {

      res.writeHead(
        200,
        {
          'Content-Type':
            'text/html; charset=utf-8'
        }
      );

      const qrSection = currentQR
        ? `
          <div class="qr-box">
            <h2>WhatsApp Login</h2>

            <p>
              WhatsApp → Linked Devices
              → Link a Device
            </p>

            <img
              src="${currentQR}"
              alt="WhatsApp QR Code"
            />

            <p class="small">
              QR Code scan করে WhatsApp Bot
              connect করুন।
            </p>
          </div>
        `
        : `
          <div class="status">
            ${
              botConnected
                ? '✅ WhatsApp Bot Connected'
                : '⏳ Waiting for WhatsApp...'
            }
          </div>
        `;

      res.end(`
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1.0"
>

<title>Starlight Family Bot</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;

  font-family:
    Arial,
    sans-serif;

  background:
    linear-gradient(
      135deg,
      #07111f,
      #101b32,
      #17243c
    );

  color: white;

  padding: 20px;
}

.card {

  width: 100%;
  max-width: 460px;

  padding: 30px;

  border-radius: 28px;

  background:
    rgba(255,255,255,0.08);

  border:
    1px solid
    rgba(255,255,255,0.14);

  box-shadow:
    0 25px 70px
    rgba(0,0,0,0.45);

  text-align: center;

  backdrop-filter:
    blur(20px);
}

.logo {

  font-size: 26px;
  font-weight: 700;

  margin-bottom: 8px;
}

.subtitle {

  opacity: .65;
  font-size: 14px;

  margin-bottom: 25px;
}

.qr-box {

  background: white;

  color: #111;

  padding: 20px;

  border-radius: 22px;
}

.qr-box img {

  width: 100%;
  max-width: 300px;

  display: block;

  margin: 20px auto;

}

.qr-box h2 {

  margin-top: 0;

}

.qr-box p {

  font-size: 14px;

}

.small {

  opacity: .65;

}

.status {

  padding: 25px;

  border-radius: 18px;

  background:
    rgba(255,255,255,0.08);

  font-size: 18px;

}

.footer {

  margin-top: 20px;

  font-size: 12px;

  opacity: .45;

}

</style>

</head>

<body>

<div class="card">

  <div class="logo">
    Starlight Family
  </div>

  <div class="subtitle">
    WhatsApp Automation Bot
  </div>

  ${qrSection}

  <div class="footer">
    Bot Server • Asia/Dhaka
  </div>

</div>

</body>

</html>
      `);

      return;
    }

    res.writeHead(404);
    res.end('Not Found');

  }
);


server.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `🌐 Health server running on port ${PORT}`
    );

  }
);


// ======================================================
// ⚙️ AUTOMATIC SCHEDULE
// ======================================================

const schedule = [

  // 🌅 MORNING GROUP ON
  {
    time: '06:00',
    action: 'on',
    message: `𝐆𝐑𝐎𝐔𝐏 𝐎𝐍 🟢

🌷 𝐀𝐬𝐬𝐚𝐥𝐚𝐦𝐮𝐚𝐥𝐚𝐢𝐤𝐮𝐦 𝐄𝐯𝐞𝐫𝐲𝐨𝐧𝐞 🤍

🌅 নতুন সকাল, নতুন শুরু ✨ 🌸 ঘুম ভাঙুক সুন্দর এক হাসিতে।

🕊️ রাতের নীরবতা শেষে

এখন আমাদের প্রিয় গ্রুপটি আবার **ON** করা হলো। 💗

☀️ সবাই উঠে পড়ুন,

আড্ডায় ফিরে আসুন! 🫶🏻

💫 𝐇𝐚𝐯𝐞 𝐚 𝐁𝐥𝐞𝐬𝐬𝐞𝐝 𝐃𝐚𝐲 💫

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 DUHR - GROUP OFF
  {
    time: '13:15',
    action: 'off',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায়

গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 DUHR - GROUP ON
  {
    time: '13:45',
    action: 'on',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে,

এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

𝑬𝒏𝒋𝒐𝒚 𝑻𝒊𝒎𝒆 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 ASR - GROUP OFF
  {
    time: '16:45',
    action: 'off',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায়

গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 ASR - GROUP ON
  {
    time: '17:15',
    action: 'on',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে,

এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

𝑬𝒏𝒋𝒐𝒚 𝑻𝒊𝒎𝒆 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 MAGHRIB - GROUP OFF
  {
    time: '18:45',
    action: 'off',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায়

গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 MAGHRIB - GROUP ON
  {
    time: '19:15',
    action: 'on',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে,

এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

𝑬𝒏𝒋𝒐𝒚 𝑻𝒊𝒎𝒆 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 ISHA - GROUP OFF
  {
    time: '20:00',
    action: 'off',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒇𝒇 🔕

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🕌 নামাজের সময় হওয়ায়

গ্রুপটি সাময়িকভাবে Off করা হলো।

🤍 সবাই নামাজ আদায় করে নিন।

𝑨𝒍𝒍𝒂𝒉 𝑯𝒂𝒇𝒆𝒛 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🕌 ISHA - GROUP ON
  {
    time: '20:30',
    action: 'on',
    message: `𝑮𝒓𝒐𝒖𝒑 𝑶𝒏 🟢

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

✨ নামাজ শেষ হয়েছে,

এখন গ্রুপ আবার Open করা হলো।

🫶🏻 সবাই আবার আড্ডায় ফিরে আসুন।

𝑬𝒏𝒋𝒐𝒚 𝑻𝒊𝒎𝒆 🌸

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  },

  // 🌙 NIGHT - GROUP OFF
  {
    time: '00:00',
    action: 'off',
    message: `─── 🌸🫧🕊️ ───

🔕 𝐆𝐑𝐎𝐔𝐏 𝐎𝐅𝐅 🔕

🌷 𝐀𝐬𝐬𝐚𝐥𝒂𝒎𝒖𝒂𝒍𝒂𝒊𝒌𝒖𝒎 🤍

🌙 রাতের নীরবতা ও আদব বজায় রাখতে

গ্রুপটি সাময়িকভাবে Off রাখা হলো। 🕊️

🚫 কোনো মেসেজ/পোস্ট নয়

🤍 শুধু সবর ও দোয়া।

🌙✨ সময় হলে গ্রুপ এজেন্ট গ্রুপ অন করে দিবে গ্রুপ। 🔔

🤲🏻 𝐀𝐥𝐥𝐚𝐡 𝐇𝐚𝐟𝐢𝐳 🤍
🌙💤 𝐆𝐨𝐨𝐝 𝐍𝐢𝐠𝐡𝐭 💤

— 𝑺𝒕𝒂𝒓𝒍𝒊𝒈𝒉𝒕 𝑭𝒂𝒎𝒊𝒍𝒚 🕊️`
  }

];


// ======================================================
// 🕐 SCHEDULE CONTROL
// ======================================================

let scheduleStarted = false;

let lastExecuted = {};

function getCurrentTime() {

  const now = new Date();

  const hours =
    String(now.getHours())
      .padStart(2, '0');

  const minutes =
    String(now.getMinutes())
      .padStart(2, '0');

  return `${hours}:${minutes}`;
}


function getLocalDate() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(now.getMonth() + 1)
      .padStart(2, '0');

  const day =
    String(now.getDate())
      .padStart(2, '0');

  return `${year}-${month}-${day}`;
}


// ======================================================
// ⏰ AUTOMATIC SCHEDULE
// ======================================================

async function runAutomaticSchedule(sock) {

  try {

    const groups =
      await sock.groupFetchAllParticipating();

    const groupIds =
      Object.keys(groups);

    if (groupIds.length === 0) {

      console.log(
        '⚠️ কোনো group পাওয়া যায়নি.'
      );

      return;
    }

    const groupId =
      groupIds[0];

    const currentTime =
      getCurrentTime();

    const today =
      getLocalDate();

    for (const item of schedule) {

      const uniqueKey =
        `${today}_${item.time}_${item.action}`;

      if (
        item.time === currentTime &&
        lastExecuted[uniqueKey] !== true
      ) {

        console.log(
          `\n⏰ Automatic Schedule: ${item.time} → ${item.action.toUpperCase()}`
        );

        try {

          if (item.action === 'off') {

            await sock.groupSettingUpdate(
              groupId,
              'announcement'
            );

            console.log(
              '🔒 Automatic Group OFF'
            );

          }

          if (item.action === 'on') {

            await sock.groupSettingUpdate(
              groupId,
              'not_announcement'
            );

            console.log(
              '🔓 Automatic Group ON'
            );

          }

          await sock.sendMessage(
            groupId,
            {
              text: item.message
            }
          );

          lastExecuted[uniqueKey] = true;

          console.log(
            '✅ Automatic message sent.'
          );

        } catch (error) {

          console.log(
            '❌ Automatic schedule failed:',
            error
          );

        }

      }

    }

  } catch (error) {

    console.log(
      '❌ Schedule checking failed:',
      error
    );

  }

}


// ======================================================
// 🤖 START BOT
// ======================================================

async function startBot() {

  console.log(
    `\n🔐 Auth directory: ${AUTH_DIR}\n`
  );

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      AUTH_DIR
    );

  const sock =
    makeWASocket({

      auth: state,

      logger:
        pino({
          level: 'silent'
        }),

      printQRInTerminal:
        false

    });


  // ====================================================
  // 💾 SAVE CREDENTIALS
  // ====================================================

  sock.ev.on(
    'creds.update',
    saveCreds
  );


  // ====================================================
  // 🔌 CONNECTION
  // ====================================================

  sock.ev.on(
    'connection.update',
    async ({
      connection,
      lastDisconnect,
      qr
    }) => {

      // ================================================
      // 📱 NEW QR
      // ================================================

      if (qr) {

        try {

          currentQR =
            await QRCode.toDataURL(
              qr,
              {
                width: 320,
                margin: 2
              }
            );

          console.log(
            '\n📱 NEW WHATSAPP QR GENERATED'
          );

          console.log(
            '🌐 Open your Deplexo app URL to scan the QR.'
          );

          console.log(
            '📱 WhatsApp → Linked Devices → Link a Device\n'
          );

        } catch (error) {

          console.log(
            '❌ QR generation failed:',
            error
          );

        }

      }


      // ================================================
      // ✅ CONNECTED
      // ================================================

      if (connection === 'open') {

        botConnected = true;

        currentQR = null;

        console.log(
          '\n================================='
        );

        console.log(
          '✅ WhatsApp Bot Connected!'
        );

        console.log(
          '=================================\n'
        );

        console.log(
          '🕐 Automatic Schedule Started'
        );

        console.log(
          '🇧🇩 Timezone: Asia/Dhaka\n'
        );

        scheduleStarted = true;

      }


      // ================================================
      // ❌ CLOSED
      // ================================================

      if (connection === 'close') {

        botConnected = false;

        currentQR = null;

        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        const shouldReconnect =
          statusCode !==
          DisconnectReason.loggedOut;


        console.log(
          '❌ WhatsApp connection closed.'
        );

        console.log(
          'Status:',
          statusCode
        );


        if (shouldReconnect) {

          console.log(
            '🔄 Reconnecting in 5 seconds...'
          );

          scheduleStarted = false;

          setTimeout(
            () => {
              startBot();
            },
            5000
          );

        } else {

          console.log(
            '⚠️ WhatsApp logged out.'
          );

        }

      }

    }
  );


  // ====================================================
  // 👋 NEW MEMBER WELCOME
  // ====================================================

  sock.ev.on(
    'group-participants.update',
    async (event) => {

      console.log(
        '\n📢 GROUP PARTICIPANT EVENT RECEIVED:'
      );

      console.log(
        JSON.stringify(
          event,
          null,
          2
        )
      );


      if (
        event.action !== 'add'
      ) {

        console.log(
          'ℹ️ Action:',
          event.action
        );

        return;

      }


      for (
        const participant of
        event.participants
      ) {

        const jid =
          participant.id;

        const number =
          jid.split('@')[0];


        try {

          await sock.sendMessage(
            event.id,
            {

              text:
`🌸 আসসালামু আলাইকুম @${number}

Starlight Family-তে তোমাকে আন্তরিকভাবে স্বাগতম। 🤍

আশা করি আমাদের Family-এর সাথে তোমার সময়টা সুন্দর কাটবে।

সবাই মিলে সুন্দরভাবে আড্ডা দিই এবং একে অপরকে সম্মান করি। 🌸`,

              mentions: [
                jid
              ]

            }
          );


          console.log(
            `✅ Welcome sent to ${number}`
          );


        } catch (error) {

          console.log(
            '❌ Welcome message failed:',
            error
          );

        }

      }

    }
  );


  // ====================================================
  // 🎛️ MANUAL /OFF /ON COMMAND
  // ====================================================

  sock.ev.on(
    'messages.upsert',
    async ({ messages }) => {

      const msg =
        messages[0];


      if (
        !msg ||
        !msg.message
      ) {
        return;
      }


      if (
        !msg.key.remoteJid?.endsWith(
          '@g.us'
        )
      ) {
        return;
      }


      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';


      const command =
        text
          .trim()
          .toLowerCase();


      // ==============================================
      // 🔒 MANUAL OFF
      // ==============================================

      if (
        command === '/off'
      ) {

        try {

          await sock.groupSettingUpdate(
            msg.key.remoteJid,
            'announcement'
          );


          await sock.sendMessage(
            msg.key.remoteJid,
            {

              text:
`🔒 Group Off

এখন থেকে শুধুমাত্র Admin-রা মেসেজ পাঠাতে পারবেন।

সবাই একটু অপেক্ষা করুন। 🤍`

            }
          );


          console.log(
            '🔒 Manual Group OFF'
          );


        } catch (error) {

          console.log(
            '❌ Group OFF failed:',
            error
          );

        }

      }


      // ==============================================
      // 🔓 MANUAL ON
      // ==============================================

      if (
        command === '/on'
      ) {

        try {

          await sock.groupSettingUpdate(
            msg.key.remoteJid,
            'not_announcement'
          );


          await sock.sendMessage(
            msg.key.remoteJid,
            {

              text:
`🔓 Group Open

এখন সবাই আবার মেসেজ করতে পারবেন।

আড্ডা শুরু করা যাক! 🌸`

            }
          );


          console.log(
            '🔓 Manual Group ON'
          );


        } catch (error) {

          console.log(
            '❌ Group ON failed:',
            error
          );

        }

      }

    }
  );


  // ====================================================
  // ⏰ START AUTOMATIC CHECK
  // ====================================================

  setInterval(
    async () => {

      if (!scheduleStarted) {
        return;
      }

      await runAutomaticSchedule(
        sock
      );

    },
    30 * 1000
  );

}


// ======================================================
// 🚀 RUN
// ======================================================

startBot().catch(
  (error) => {

    console.error(
      '❌ Bot startup failed:',
      error
    );

  }
);
