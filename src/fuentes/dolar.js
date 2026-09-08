import { traer } from '../lib/http.js';

const PRINCIPAL = 'https://dolarapi.com/v1/dolares';
const RESPALDO = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/ultimo';

const normalizar = (c) => ({
  casa: c.casa,
  nombre: c.nombre,
  compra: Number(c.compra),
  venta: Number(c.venta),
  actualizado: c.fechaActualizacion ?? c.fecha ?? null,
});

/**
 * Cotizaciones actuales. Devuelve { oficial, blue, brecha, fuente }.
 * dolarapi.com es la fuente principal; si falla se cae a api.argentinadatos.com.
 */
export async function cotizaciones() {
  let lista, fuente = 'dolarapi.com';
  try {
    lista = await traer(PRINCIPAL);
  } catch {
    lista = await traer(RESPALDO);
    fuente = 'argentinadatos.com';
  }
  const por = Object.fromEntries(lista.map((c) => [c.casa, normalizar(c)]));
  const oficial = por.oficial;
  const blue = por.blue;
  if (!oficial?.venta || !blue?.venta) throw new Error('La fuente no devolvió oficial y blue');
  return {
    oficial,
    blue,
    // Brecha cambiaria: cuánto está el blue por encima del oficial.
    brecha: ((blue.venta - oficial.venta) / oficial.venta) * 100,
    otros: { bolsa: por.bolsa, contadoconliqui: por.contadoconliqui, mayorista: por.mayorista, tarjeta: por.tarjeta },
    fuente,
    consultado: new Date().toISOString(),
  };
}

/** Serie diaria histórica de una casa ('oficial' | 'blue'). */
export async function historial(casa) {
  const datos = await traer(`https://api.argentinadatos.com/v1/cotizaciones/dolares/${casa}`, { timeout: 30000 });
  return datos.map((d) => ({ fecha: d.fecha, compra: Number(d.compra), venta: Number(d.venta) }));
}
