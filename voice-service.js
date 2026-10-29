const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

export function voiceConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

export async function textToSpeech(text) {
  if (!voiceConfigured()) throw new Error('ELEVENLABS_API_KEY এবং ELEVENLABS_VOICE_ID .env ফাইলে সেট করুন।');
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  const response = await fetch(`${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({ text: String(text).slice(0, 2500), model_id: modelId,
      voice_settings: { stability: 0.52, similarity_boost: 0.78, style: 0.18, use_speaker_boost: true } })
  });
  if (!response.ok) throw new Error(`ElevenLabs TTS error (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function transcribeAudio(buffer, mimetype = 'audio/ogg') {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ভয়েস মেসেজ বুঝতে ELEVENLABS_API_KEY প্রয়োজন।');
  const form = new FormData();
  const extension = /mpeg|mp3/i.test(mimetype) ? 'mp3' : /wav/i.test(mimetype) ? 'wav' : /mp4|m4a/i.test(mimetype) ? 'm4a' : 'ogg';
  form.append('file', new Blob([buffer], { type: mimetype }), `voice.${extension}`);
  form.append('model_id', process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v1');
  form.append('language_code', 'ben');
  const response = await fetch(`${ELEVEN_BASE}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: form });
  if (!response.ok) throw new Error(`ElevenLabs STT error (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  return String(json.text || '').trim();
}

export async function generateReply(text) {
  if (!process.env.OPENAI_API_KEY) throw new Error('AI উত্তর তৈরির জন্য OPENAI_API_KEY .env ফাইলে দিন।');
  const endpoint = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.7,
      messages: [
        { role: 'system', content: 'তুমি Starlight Family WhatsApp গ্রুপের বন্ধুসুলভ, ভদ্র বাংলা AI সহকারী। স্বাভাবিক ও সংক্ষিপ্ত বাংলায় উত্তর দেবে। নিজেকে বাস্তব মানুষ বা বাস্তব নারী বলে পরিচয় দেবে না।' },
        { role: 'user', content: String(text).slice(0, 3000) }
      ] })
  });
  if (!response.ok) throw new Error(`AI API error (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  return String(json.choices?.[0]?.message?.content || '').trim() || 'দুঃখিত, এখন উত্তর তৈরি করতে পারছি না।';
}
