/**
 * Los destinatarios vienen en un único secreto `DESTINATARIOS`, un JSON así:
 * [
 *   {"nombre":"Ezequiel","email":"vos@mail.com","whatsapp":"+5493411111111","callmebot":"123456"},
 *   {"nombre":"Fulano","email":"otro@mail.com","whatsapp":"+5493412222222","callmebot":"654321"}
 * ]
 * Cada campo es opcional salvo `nombre`: si alguien sólo tiene email, sólo recibe email.
 * `solo` permite limitar a qué avisos se suscribe: ["apertura","cierre","salto","cac"].
 */
export function destinatarios() {
  const crudo = process.env.DESTINATARIOS?.trim();
  if (!crudo) return [];
  let lista;
  try {
    lista = JSON.parse(crudo);
  } catch (e) {
    throw new Error(`DESTINATARIOS no es JSON válido: ${e.message}`);
  }
  if (!Array.isArray(lista)) throw new Error('DESTINATARIOS tiene que ser un array JSON');
  return lista.map((d, i) => ({
    nombre: d.nombre ?? `destinatario ${i + 1}`,
    email: d.email ?? null,
    whatsapp: d.whatsapp ?? null,
    callmebot: d.callmebot ?? null,
    solo: Array.isArray(d.solo) ? d.solo : null,
  }));
}

/** Destinatarios suscriptos a un tipo de aviso. */
export const paraAviso = (tipo) => destinatarios().filter((d) => !d.solo || d.solo.includes(tipo));
