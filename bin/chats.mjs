#!/usr/bin/env node
// Muestra los chat id de Telegram de quien le haya escrito al bot.
// Uso: TELEGRAM_BOT_TOKEN=... node bin/chats.mjs
import { chatsRecientes } from '../src/canales/telegram.js';

const chats = await chatsRecientes();
if (!chats.length) {
  console.log('Nadie le escribió al bot todavía.\nQue cada persona le mande "hola" por Telegram y volvé a correr esto.');
  process.exit(0);
}
console.log('Chat id encontrados:\n');
for (const c of chats) console.log(`  ${String(c.id).padEnd(14)} ${c.quien}`);
console.log('\nCopiá el número en el campo "telegram" de cada destinatario.');
