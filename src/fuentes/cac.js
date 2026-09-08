import { traer } from '../lib/http.js';
import { nombreMes, partesAR } from '../lib/fmt.js';

// El índice CAC lo publica CAMARCO una vez por mes, alrededor del 20 al 25, y
// corresponde al mes ANTERIOR: el 20 de agosto sale el índice de julio.
//
// OJO con la fecha: hay dos convenciones dando vueltas y nombran distinto al mismo número.
//   · CAMARCO lo llama por el mes que MIDE            -> "julio 2026: +1,48%"
//   · Los cálculos de obra lo llaman por el mes en que se APLICA, que es el mes
//     en curso (el último publicado es el que se usa) -> "septiembre 2026: +1,48%"
// Para que no haya confusión, cada aviso muestra las dos.
//
// Fuentes, en orden:
//   1. api de factibilia.com -> serie mensual completa desde 2011 (general/materiales/mano de obra)
//   2. calculadoracac.com.ar -> ventana de la próxima publicación y control cruzado del período
//   3. el HTML de factibilia  -> respaldo si la api se cae

const API_SERIE = 'https://www.factibilia.com/api/herramientas/cac';

const aTexto = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesNumero = (nombre) => MESES.indexOf(nombre.toLowerCase().trim()) + 1;

function aNumero(s) {
  if (s == null) return null;
  let t = String(s).trim().replace(/\s/g, '').replace('%', '').replace('+', '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const varPct = (desde, hasta) =>
  desde && hasta ? Number((((hasta - desde) / desde) * 100).toFixed(2)) : null;

/** Serie mensual completa, ordenada de más viejo a más nuevo. */
export async function serieCac() {
  const crudo = await traer(API_SERIE, { timeout: 25000 });
  if (!Array.isArray(crudo) || !crudo.length) throw new Error('La serie del CAC vino vacía');
  return crudo
    .map((r) => ({
      anio: Number(r.anio),
      mes: Number(r.mes),
      clave: `${r.anio}-${String(r.mes).padStart(2, '0')}`,
      general: Number(r.valor),
      materiales: Number(r.materiales),
      manoDeObra: Number(r.manoObra),
    }))
    .filter((r) => r.anio && r.mes && Number.isFinite(r.general))
    .sort((a, b) => a.clave.localeCompare(b.clave));
}

/** Ventana de la próxima publicación y período, según calculadoracac.com.ar. */
async function contexto() {
  const txt = aTexto(await traer('https://calculadoracac.com.ar/', { texto: true, timeout: 25000 }));
  const per = txt.match(/Nuevos\s+Índices\s+de\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s+(\d{4})/i);
  return {
    anio: per ? Number(per[2]) : null,
    mes: per ? mesNumero(per[1]) : null,
    proximaPublicacion: txt.match(/Próxima\s+publicación:\s*([^)]+)\)/i)?.[1]?.trim() ?? null,
  };
}

/** Respaldo: el titular del HTML de factibilia, por si la api no responde. */
async function respaldoHtml() {
  const txt = aTexto(await traer('https://www.factibilia.com/labs-cac', { texto: true, timeout: 25000 }));
  const per = txt.match(/Índice\s+CAC\s+de\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s+(\d{4})/i);
  if (!per) throw new Error('respaldo: no se encontró el período');
  const bloque = txt.slice(txt.indexOf(per[0]), txt.indexOf(per[0]) + 400);
  const val = (et) => aNumero(bloque.match(new RegExp(`${et}\\s+(-?[\\d.,]+)`, 'i'))?.[1]);
  return [{
    anio: Number(per[2]), mes: mesNumero(per[1]),
    clave: `${per[2]}-${String(mesNumero(per[1])).padStart(2, '0')}`,
    general: val('General'), materiales: val('Materiales'), manoDeObra: val('Mano de obra'),
  }];
}

/**
 * Último índice CAC publicado, con el año en curso mes a mes y el acumulado.
 * `mes`/`periodo` son el mes que MIDE el índice; `aplicaA`, el mes en que se usa.
 */
export async function ultimoCac() {
  let serie, fuentes = ['factibilia.com (serie)'];
  try {
    serie = await serieCac();
  } catch {
    serie = await respaldoHtml();
    fuentes = ['factibilia.com (html)'];
  }

  const ctx = await contexto().catch(() => ({ anio: null, mes: null, proximaPublicacion: null }));
  if (ctx.proximaPublicacion) fuentes.push('calculadoracac.com.ar');

  const ultimo = serie.at(-1);
  const previo = serie.at(-2);
  const enClave = (c) => serie.find((r) => r.clave === c) ?? null;

  // Meses del año del último índice publicado, sólo el nivel general.
  const anioEnCurso = serie
    .filter((r) => r.anio === ultimo.anio)
    .map((r, i, arr) => ({
      mes: r.mes,
      nombre: nombreMes(r.mes),
      indice: r.general,
      variacion: varPct((i > 0 ? arr[i - 1] : enClave(`${ultimo.anio - 1}-12`))?.general, r.general),
    }));

  const cierreAnterior = enClave(`${ultimo.anio - 1}-12`);
  const cierreAnteAnterior = enClave(`${ultimo.anio - 2}-12`);

  // Con uno, dos o tres meses el año todavía no dice nada: se agrega el total del año anterior.
  const pocosMeses = ultimo.mes <= 3;

  return {
    anio: ultimo.anio,
    mes: ultimo.mes,
    periodo: `${nombreMes(ultimo.mes)} ${ultimo.anio}`,
    clave: ultimo.clave,
    // El último índice publicado es el que se usa para el mes en curso.
    aplicaA: `${nombreMes(partesAR().mes)} ${partesAR().anio}`,
    indice: { general: ultimo.general, materiales: ultimo.materiales, manoDeObra: ultimo.manoDeObra },
    variacion: {
      general: varPct(previo?.general, ultimo.general),
      materiales: varPct(previo?.materiales, ultimo.materiales),
      manoDeObra: varPct(previo?.manoDeObra, ultimo.manoDeObra),
    },
    interanual: varPct(enClave(`${ultimo.anio - 1}-${String(ultimo.mes).padStart(2, '0')}`)?.general, ultimo.general),
    anioEnCurso,
    acumulado: varPct(cierreAnterior?.general, ultimo.general),
    anioAnterior: pocosMeses && cierreAnterior && cierreAnteAnterior
      ? { anio: ultimo.anio - 1, pct: varPct(cierreAnteAnterior.general, cierreAnterior.general) }
      : null,
    proximaPublicacion: ctx.proximaPublicacion,
    discrepancia: ctx.mes && (ctx.mes !== ultimo.mes || ctx.anio !== ultimo.anio)
      ? `la serie termina en ${ultimo.clave} y calculadoracac dice ${ctx.anio}-${String(ctx.mes).padStart(2, '0')}` : null,
    fuentes,
    consultado: new Date().toISOString(),
  };
}
