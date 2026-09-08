// Telegram: gratis, sin límites prácticos, sin aprobación de plantillas ni número de por medio.
// Hace falta un bot (se crea con @BotFather en 2 minutos) y el chat id de cada destinatario.
//   TELEGRAM_BOT_TOKEN  -> el token que devuelve BotFather
//   cada destinatario   -> campo "telegram" con su chat id

const API = (metodo) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`;

export const hayTelegram = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

/** Manda un mensaje de texto a un chat. */
export async function enviarTelegram({ chatId, texto }) {
  if (!chatId) return { salteado: 'sin chat id de Telegram' };
  if (!hayTelegram()) return { salteado: 'sin TELEGRAM_BOT_TOKEN' };
  const res = await fetch(API('sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, disable_web_page_preview: true }),
  });
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok || cuerpo.ok === false) {
    throw new Error(`Telegram ${res.status}: ${cuerpo.description ?? JSON.stringify(cuerpo).slice(0, 200)}`);
  }
  return { proveedor: 'telegram', chatId };
}

/**
 * Ayuda para descubrir los chat id: devuelve quién le escribió al bot últimamente.
 * Se usa desde `node bin/chats.mjs`.
 */
export async function chatsRecientes() {
  if (!hayTelegram()) throw new Error('Falta TELEGRAM_BOT_TOKEN');
  const res = await fetch(API('getUpdates'));
  const cuerpo = await res.json();
  if (!cuerpo.ok) throw new Error(`Telegram: ${cuerpo.description}`);
  const vistos = new Map();
  for (const u of cuerpo.result) {
    const chat = u.message?.chat ?? u.channel_post?.chat;
    if (chat) vistos.set(chat.id, [chat.first_name, chat.last_name, chat.title, chat.username && `@${chat.username}`].filter(Boolean).join(' '));
  }
  return [...vistos].map(([id, quien]) => ({ id, quien }));
}
