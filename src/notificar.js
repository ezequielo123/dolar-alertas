import { enviarEmail } from './canales/email.js';
import { enviarWhatsapp } from './canales/whatsapp.js';
import { enviarTelegram } from './canales/telegram.js';
import { paraAviso } from './destinatarios.js';

/**
 * Manda un aviso por los canales disponibles de cada destinatario.
 * Un canal que falla no frena a los demás: se junta todo y se reporta al final.
 * @param {'apertura'|'cierre'|'salto'|'cac'} tipo
 */
export async function avisar(tipo, { asunto, html, texto, wa }) {
  const gente = paraAviso(tipo);
  if (!gente.length) {
    console.warn('⚠️  No hay destinatarios configurados (revisá el secreto DESTINATARIOS).');
    return { enviados: 0, errores: [] };
  }

  const seco = process.env.DRY_RUN === '1';
  if (seco) {
    console.log(`\n[DRY_RUN] aviso "${tipo}" para ${gente.map((d) => d.nombre).join(', ')}`);
    console.log(`Asunto: ${asunto}\n---\n${texto}\n---`);
    return { enviados: 0, errores: [], seco: true };
  }

  const errores = [];
  let enviados = 0;

  // Un solo mail con todos los destinatarios en el "to".
  const correos = gente.map((d) => d.email).filter(Boolean);
  if (correos.length) {
    try {
      const r = await enviarEmail({ para: correos, asunto, html, texto });
      if (r.salteado) console.log(`✉️  email salteado: ${r.salteado}`);
      else { enviados += correos.length; console.log(`✉️  email enviado por ${r.proveedor} a ${correos.join(', ')}`); }
    } catch (e) {
      errores.push(`email: ${e.message}`);
      console.error(`✉️  error de email: ${e.message}`);
    }
  }

  // Telegram y WhatsApp son uno por uno.
  for (const d of gente.filter((x) => x.telegram)) {
    try {
      const r = await enviarTelegram({ chatId: d.telegram, texto });
      if (r.salteado) console.log(`💬 Telegram a ${d.nombre} salteado: ${r.salteado}`);
      else { enviados++; console.log(`💬 Telegram enviado a ${d.nombre}`); }
    } catch (e) {
      errores.push(`telegram ${d.nombre}: ${e.message}`);
      console.error(`💬 error de Telegram a ${d.nombre}: ${e.message}`);
    }
  }

  for (const d of gente.filter((x) => x.whatsapp)) {
    try {
      const r = await enviarWhatsapp({ telefono: d.whatsapp, texto, wa });
      if (r.salteado) console.log(`📱 WhatsApp a ${d.nombre} salteado: ${r.salteado}`);
      else { enviados++; console.log(`📱 WhatsApp enviado a ${d.nombre} por ${r.proveedor}`); }
    } catch (e) {
      errores.push(`whatsapp ${d.nombre}: ${e.message}`);
      console.error(`📱 error de WhatsApp a ${d.nombre}: ${e.message}`);
    }
  }

  return { enviados, errores };
}
