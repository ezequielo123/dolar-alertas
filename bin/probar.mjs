#!/usr/bin/env node
// Vista previa de los cuatro avisos con datos reales, sin enviar nada.
// Uso: node bin/probar.mjs [carpeta-de-salida]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cotizaciones } from '../src/fuentes/dolar.js';
import { ultimoCac } from '../src/fuentes/cac.js';
import { mailDiario, mailSalto, mailCac } from '../src/plantillas.js';
import { destinatarios } from '../src/destinatarios.js';
import { hayEmail } from '../src/canales/email.js';
import { hayTelegram } from '../src/canales/telegram.js';
import { hayMeta, hayTwilio } from '../src/canales/whatsapp.js';
import { fechaHoraAR } from '../src/lib/fmt.js';

const salida = process.argv[2] || join(process.cwd(), 'vista-previa');
mkdirSync(salida, { recursive: true });

const cot = await cotizaciones();
const cac = await ultimoCac().catch((e) => { console.error('CAC no disponible:', e.message); return null; });

// Referencias de ejemplo para que se vean las variaciones.
const ayer = { oficial: cot.oficial.venta * 0.994, blue: cot.blue.venta * 0.991 };
const anclaSalto = { hora: '14:20', oficial: cot.oficial.venta * 0.985, blue: cot.blue.venta * 0.978 };

const avisos = [
  ['apertura', mailDiario({ momento: 'apertura', cot, referencia: ayer })],
  ['cierre', mailDiario({ momento: 'cierre', cot, referencia: ayer })],
  ['salto', mailSalto({
    cot,
    ancla: anclaSalto,
    saltos: [
      { casa: 'blue', etiqueta: 'Blue', de: anclaSalto.blue, a: cot.blue.venta, pct: ((cot.blue.venta - anclaSalto.blue) / anclaSalto.blue) * 100, desde: anclaSalto.hora },
    ],
  })],
  ...(cac ? [['cac', mailCac(cac)]] : []),
];

for (const [nombre, aviso] of avisos) {
  writeFileSync(join(salida, `${nombre}.html`), aviso.html);
  console.log(`\n═══ ${nombre.toUpperCase()} ═══`);
  console.log(`Asunto: ${aviso.asunto}`);
  console.log('--- Telegram / Twilio (texto completo) ---');
  console.log(aviso.texto);
  if (aviso.wa) {
    console.log('--- WhatsApp por plantilla de Meta (3 variables, sin saltos de línea) ---');
    console.log(`{{1}} ${aviso.wa.titulo}`);
    console.log(`{{2}} ${aviso.wa.resumen}`);
    console.log(`{{3}} ${aviso.wa.momento}`);
  }
}

const gente = destinatarios();
console.log(`\n═══ CONFIGURACIÓN (${fechaHoraAR()}) ═══`);
console.log(`Email:    ${hayEmail() ? 'listo' : 'FALTA RESEND_API_KEY o BREVO_API_KEY'}`);
console.log(`Telegram: ${hayTelegram() ? 'listo' : 'FALTA TELEGRAM_BOT_TOKEN'}`);
console.log(`WhatsApp: ${hayMeta() ? 'listo (Meta Cloud API)' : hayTwilio() ? 'listo (Twilio)' : 'sin configurar'}`);
console.log(`Destinatarios: ${gente.length ? gente.map((d) => `${d.nombre} [${[d.email && 'mail', d.telegram && 'telegram', d.whatsapp && 'whatsapp'].filter(Boolean).join('+') || 'sin canales'}]`).join(', ') : 'FALTA el secreto DESTINATARIOS'}`);
console.log(`\nHTML de los mails en: ${salida}`);
