// WhatsApp por HTTP, sin dependencias. Dos caminos:
//   CallMeBot  -> gratis, sin cuenta. Cada destinatario le manda una vez
//                 "I allow callmebot to send me messages" al +34 621 331 709 y recibe su apikey.
//   Twilio     -> TWILIO_SID + TWILIO_TOKEN + TWILIO_FROM (usar si querés algo con SLA).
// Si el destinatario tiene `callmebot`, se usa CallMeBot; si no, Twilio.

async function porCallMeBot({ telefono, apikey, texto }) {
  const url = 'https://api.callmebot.com/whatsapp.php'
    + `?phone=${encodeURIComponent(telefono)}`
    + `&text=${encodeURIComponent(texto)}`
    + `&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'dolar-alertas/1.0' } });
  const cuerpo = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  // CallMeBot contesta 200 incluso ante algunos errores: hay que mirar el cuerpo.
  const ok = res.ok && !/(api\s*key|apikey).{0,40}(not valid|invalid|wrong)|error|not authorized/i.test(cuerpo);
  if (!ok) throw new Error(`CallMeBot ${res.status}: ${cuerpo.slice(0, 200)}`);
  return 'callmebot';
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

/** Manda un WhatsApp a un destinatario. Devuelve el canal usado o un motivo de salteo. */
export async function enviarWhatsapp({ telefono, callmebot, texto }) {
  if (!telefono) return { salteado: 'sin teléfono' };
  if (callmebot) return { proveedor: await porCallMeBot({ telefono, apikey: callmebot, texto }), telefono };
  if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_FROM) {
    return { proveedor: await porTwilio({ telefono, texto }), telefono };
  }
  return { salteado: 'sin apikey de CallMeBot ni credenciales de Twilio' };
}
