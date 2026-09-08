import { traer } from '../lib/http.js';
import { nombreMes } from '../lib/fmt.js';

// El índice CAC lo publica CAMARCO en PDF una vez por mes (entre el 20 y el 25).
// No existe API oficial, así que se leen dos réplicas públicas y se combinan:
//   calculadoracac.com.ar -> variaciones con 2 decimales + ventana de próxima publicación
//   factibilia.com        -> valores absolutos del índice (los que se usan para actualizar contratos)
// Las dos renderizan en el servidor, así que alcanza con leer el HTML.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const aTexto = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const mesNumero = (nombre) => MESES.indexOf(nombre.toLowerCase().trim()) + 1;

/** '21.960,7' -> 21960.7 ; '1.48' -> 1.48 */
function aNumero(s) {
  if (s == null) return null;
  let t = String(s).trim().replace(/\s/g, '').replace('%', '').replace('+', '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');       // formato es-AR
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, ''); // 21.960 miles
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

async function calculadoraCac() {
  const txt = aTexto(await traer('https://calculadoracac.com.ar/', { texto: true, timeout: 25000 }));
  const per = txt.match(/Nuevos\s+Índices\s+de\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s+(\d{4})/i);
  if (!per) throw new Error('calculadoracac: no se encontró el período');
  const mes = mesNumero(per[1]);
  if (!mes) throw new Error(`calculadoracac: mes desconocido "${per[1]}"`);

  const varDe = (etiqueta) => {
    const re = new RegExp(`${etiqueta}\\s+Variación[^\\d-]{0,60}(-?[\\d.,]+)\\s*%`, 'i');
    return aNumero(txt.match(re)?.[1]);
  };
  const prox = txt.match(/Próxima\s+publicación:\s*([^)]+)\)/i)?.[1]?.trim() ?? null;

  return {
    anio: Number(per[2]),
    mes,
    variacion: { general: varDe('General'), materiales: varDe('Materiales'), manoDeObra: varDe('Mano de Obra') },
    proximaPublicacion: prox,
  };
}

async function factibilia() {
  const txt = aTexto(await traer('https://www.factibilia.com/labs-cac', { texto: true, timeout: 25000 }));
  const per = txt.match(/Índice\s+CAC\s+de\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s+(\d{4})/i);
  if (!per) throw new Error('factibilia: no se encontró el período');
  const bloque = txt.slice(txt.indexOf(per[0]), txt.indexOf(per[0]) + 400);
  const val = (etiqueta) => aNumero(bloque.match(new RegExp(`${etiqueta}\\s+(-?[\\d.,]+)`, 'i'))?.[1]);
  return {
    anio: Number(per[2]),
    mes: mesNumero(per[1]),
    indice: { general: val('General'), materiales: val('Materiales'), manoDeObra: val('Mano de obra') },
    interanual: aNumero(bloque.match(/Interanual\s+(\+?-?[\d.,]+)\s*%/i)?.[1]),
    varMensual: aNumero(bloque.match(/Var\.\s*mensual\s+(\+?-?[\d.,]+)\s*%/i)?.[1]),
  };
}

/**
 * Último índice CAC publicado.
 * Combina las dos fuentes; si una falla se devuelve lo que haya conseguido la otra.
 * Devuelve null sólo si fallan las dos.
 */
export async function ultimoCac() {
  const [a, b] = await Promise.allSettled([calculadoraCac(), factibilia()]);
  const calc = a.status === 'fulfilled' ? a.value : null;
  const fact = b.status === 'fulfilled' ? b.value : null;
  if (!calc && !fact) {
    const motivo = [a.reason?.message, b.reason?.message].filter(Boolean).join(' | ');
    throw new Error(`No se pudo leer el índice CAC de ninguna fuente: ${motivo}`);
  }
  const base = calc ?? fact;
  const fuentes = [calc && 'calculadoracac.com.ar', fact && 'factibilia.com'].filter(Boolean);

  return {
    anio: base.anio,
    mes: base.mes,
    periodo: `${nombreMes(base.mes)} ${base.anio}`,      // 'julio 2026'
    clave: `${base.anio}-${String(base.mes).padStart(2, '0')}`, // '2026-07' (para no repetir el aviso)
    variacion: {
      general: calc?.variacion.general ?? fact?.varMensual ?? null,
      materiales: calc?.variacion.materiales ?? null,
      manoDeObra: calc?.variacion.manoDeObra ?? null,
    },
    indice: fact?.indice ?? { general: null, materiales: null, manoDeObra: null },
    interanual: fact?.interanual ?? null,
    proximaPublicacion: calc?.proximaPublicacion ?? null,
    fuentes,
    // Las dos fuentes deberían coincidir en el período; si no, algo cambió y conviene mirarlo.
    discrepancia: calc && fact && (calc.mes !== fact.mes || calc.anio !== fact.anio)
      ? `calculadoracac dice ${calc.mes}/${calc.anio} y factibilia ${fact.mes}/${fact.anio}` : null,
    consultado: new Date().toISOString(),
  };
}
