// WhatsApp saliente. Dos caminos, se elige por variables de entorno:
//
//   Meta Cloud API (oficial)  -> WHATSAPP_TOKEN + WHATSAPP_PHONE_ID
//   Twilio                    -> TWILIO_SID + TWILIO_TOKEN + TWILIO_FROM
//
// Ojo con Meta: un mensaje que inicia la empresa fuera de la ventana de 24 h
// SÓLO sale como plantilla aprobada, y los valores de las variables no pueden
// tener saltos de línea. Por eso cada aviso arma además un resumen de una línea.

const soloDigitos = (t) => String(t).replace(/\D/g, '');

export const hayMeta = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
export const hayTwilio = () => Boolean(process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM);

/** Traduce el error de Meta a algo accionable. */
function errorMeta(status, crudo) {
  let code;
  try { code = JSON.parse(crudo)?.error?.code; } catch { /* no era JSON */ }
  if (code === 190 || status === 401) return 'el token de WhatsApp venció o es inválido';
  if (code === 131047 || code === 131051) return 'Meta pide plantilla aprobada (el texto libre sólo entra en la ventana de 24 h)';
  if (code === 132001) return `la plantilla "${process.env.WHATSAPP_PLANTILLA ?? 'alerta_mercado_ar'}" no existe o no está aprobada en ese idioma`;
  if (code === 132000) return 'la plantilla espera otra cantidad de variables';
  if (status === 429) return 'Meta está limitando los envíos, probá más tarde';
  return `${status}: ${crudo.slice(0, 200)}`;
}

async function porMeta({ telefono, wa }) {
  const cuerpo = {
    messaging_product: 'whatsapp',
    to: soloDigitos(telefono),
    type: 'template',
    template: {
      name: process.env.WHATSAPP_PLANTILLA || 'alerta_mercado_ar',
      language: { code: process.env.WHATSAPP_IDIOMA || 'es' },
      components: [{ type: 'body', parameters: [wa.titulo, wa.resumen, wa.momento].map((text) => ({ type: 'text', text })) }],
    },
  };
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`WhatsApp (Meta) ${errorMeta(res.status, await res.text().catch(() => ''))}`);
  return 'meta';
}

async function porTwilio({ telefono, texto }) {
  const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
  const cuerpo = new URLSearchParams({
    From: TWILIO_FROM.startsWith('whatsapp:') ? TWILIO_FROM : `whatsapp:${TWILIO_FROM}`,
    To: `whatsapp:${telefono}`,
    Body: texto,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: cuerpo,
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return 'twilio';
}

/** Manda un WhatsApp a un destinatario. `wa` es el resumen de una línea para la plantilla de Meta. */
export async function enviarWhatsapp({ telefono, texto, wa }) {
  if (!telefono) return { salteado: 'sin teléfono' };
  if (hayMeta()) return { proveedor: await porMeta({ telefono, wa }), telefono };
  if (hayTwilio()) return { proveedor: await porTwilio({ telefono, texto }), telefono };
  return { salteado: 'sin credenciales de Meta ni de Twilio' };
}
