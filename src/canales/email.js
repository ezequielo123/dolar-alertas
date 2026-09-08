// Email por HTTP, sin dependencias. Se elige el proveedor por variables de entorno:
//   RESEND_API_KEY  -> resend.com   (3.000 mails/mes gratis, requiere dominio verificado)
//   BREVO_API_KEY   -> brevo.com    (300 mails/día gratis, alcanza con verificar el remitente)
// Si están las dos, gana Resend.

function remitente() {
  const email = process.env.MAIL_FROM?.trim();
  // Brevo y Resend rechazan cualquier remitente que no esté verificado en la cuenta;
  // fallar acá con un mensaje claro evita perseguir un 400 críptico del proveedor.
  if (!email) throw new Error('Falta MAIL_FROM: tiene que ser la casilla verificada como remitente en Brevo o Resend');
  return { email, nombre: process.env.MAIL_FROM_NOMBRE || 'Alertas Dólar' };
}

async function porResend({ para, asunto, html, texto }) {
  const de = remitente();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: `${de.nombre} <${de.email}>`, to: para, subject: asunto, html, text: texto }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return 'resend';
}

async function porBrevo({ para, asunto, html, texto }) {
  const de = remitente();
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: de.email, name: de.nombre },
      to: para.map((email) => ({ email })),
      subject: asunto,
      htmlContent: html,
      textContent: texto,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return 'brevo';
}

export const hayEmail = () => Boolean(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY);

/** Manda un mail a todas las direcciones de una. Lanza si el proveedor rechaza. */
export async function enviarEmail({ para, asunto, html, texto }) {
  const destinos = (Array.isArray(para) ? para : [para]).filter(Boolean);
  if (!destinos.length) return { salteado: 'sin destinatarios de email' };
  if (!hayEmail()) return { salteado: 'sin RESEND_API_KEY ni BREVO_API_KEY' };
  const proveedor = process.env.RESEND_API_KEY ? porResend : porBrevo;
  return { proveedor: await proveedor({ para: destinos, asunto, html, texto }), destinos };
}
