import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys';

import qrcode from 'qrcode-terminal';
import pino from 'pino';


// ======================================================
// ⚙️ SETTINGS
// ======================================================

// Bangladesh Time
process.env.TZ = 'Asia/Dhaka';

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

𝑨𝒔𝒔𝒂𝒍𝒂𝒎𝒖 𝑨𝒍𝒂𝒊𝒌𝒖𝒎 🤍

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

🌷 𝐀𝐬𝐬𝐚𝐥𝐚𝐦𝐮 𝐀𝐥𝐚𝐢𝐤𝐮𝐦 🤍

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

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}


async function runAutomaticSchedule(sock) {

  try {

    const groups = await sock.groupFetchAllParticipating();

    const groupIds = Object.keys(groups);

    // Bot যে group-এ আছে তার মধ্যে
    // প্রথম group-টিকে automatic group হিসেবে ব্যবহার করবে
    if (groupIds.length === 0) {
      console.log('⚠️ কোনো group পাওয়া যায়নি.');
      return;
    }

    const groupId = groupIds[0];

    const currentTime = getCurrentTime();

    const today = new Date().toISOString().split('T')[0];

    for (const item of schedule) {

      const uniqueKey = `${today}_${item.time}_${item.action}`;

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

            console.log('🔒 Automatic Group OFF');

          }

          if (item.action === 'on') {

            await sock.groupSettingUpdate(
              groupId,
              'not_announcement'
            );

            console.log('🔓 Automatic Group ON');

          }

          await sock.sendMessage(groupId, {
            text: item.message
          });

          lastExecuted[uniqueKey] = true;

          console.log('✅ Automatic message sent.');

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

  const { state, saveCreds } =
    await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({

    auth: state,

    logger: pino({
      level: 'silent'
    }),

    printQRInTerminal: false

  });


  // Save login credentials
  sock.ev.on(
    'creds.update',
    saveCreds
  );


  // ====================================================
  // 🔌 CONNECTION
  // ====================================================

  sock.ev.on(
    'connection.update',
    ({ connection, lastDisconnect, qr }) => {

      if (qr) {

        console.log(
          '\n📱 WhatsApp QR Code:\n'
        );

        qrcode.generate(
          qr,
          {
            small: true
          }
        );

        console.log(
          '\nএই QR Code তোমার Bot WhatsApp নম্বর দিয়ে scan করো.\n'
        );

      }


      if (connection === 'open') {

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


      if (connection === 'close') {

        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode
          !== DisconnectReason.loggedOut;


        console.log(
          '❌ WhatsApp connection closed.'
        );


        if (shouldReconnect) {

          console.log(
            '🔄 Reconnecting...'
          );

          startBot();

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


      if (event.action !== 'add') {

        console.log(
          'ℹ️ Action:',
          event.action
        );

        return;

      }


      for (
        const participant of event.participants
      ) {

        const jid = participant.id;

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

              mentions: [jid]

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

      const msg = messages[0];


      if (!msg.message) return;


      if (
        !msg.key.remoteJid?.endsWith('@g.us')
      ) {
        return;
      }


      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';


      const command =
        text.trim().toLowerCase();


      // ==========================
      // 🔒 MANUAL OFF
      // ==========================

      if (command === '/off') {

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


      // ==========================
      // 🔓 MANUAL ON
      // ==========================

      if (command === '/on') {

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

startBot();
