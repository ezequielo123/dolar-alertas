// Formato y fechas, todo en hora de Argentina (America/Argentina/Buenos_Aires).
// Nunca usar toISOString().slice(0,10): de 21:00 en adelante adelanta un día.

export const TZ = 'America/Argentina/Buenos_Aires';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Partes de una fecha en hora argentina. */
export function partesAR(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return {
    anio: Number(p.year), mes: Number(p.month), dia: Number(p.day),
    hora: Number(p.hour) % 24, minuto: Number(p.minute),
    iso: `${p.year}-${p.month}-${p.day}`,
    diaSemana: p.weekday,
  };
}

/** '2026-09-08' en hora argentina. */
export const hoyAR = (d = new Date()) => partesAR(d).iso;

/** '08/09/2026 18:15'. */
export function fechaHoraAR(d = new Date()) {
  const p = partesAR(d);
  const z = (n) => String(n).padStart(2, '0');
  return `${z(p.dia)}/${z(p.mes)}/${p.anio} ${z(p.hora)}:${z(p.minuto)}`;
}

/** '8 de septiembre de 2026'. */
export function fechaLargaAR(d = new Date()) {
  const p = partesAR(d);
  return `${p.dia} de ${MESES[p.mes - 1]} de ${p.anio}`;
}

export const nombreMes = (n) => MESES[n - 1] ?? '';

/** true de lunes a viernes (hora argentina). */
export const esDiaHabil = (d = new Date()) =>
  !['Sat', 'Sun'].includes(partesAR(d).diaSemana);

/** 1530 -> '$ 1.530,00' */
export const pesos = (n) =>
  n == null || Number.isNaN(n) ? '—'
    : '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1530 -> '$ 1.530' (sin centavos, para títulos) */
export const pesosCorto = (n) =>
  n == null || Number.isNaN(n) ? '—'
    : '$ ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

/** 1.4823 -> '+1,48%' */
export function pct(n, decimales = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  const s = n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${n > 0 ? '+' : ''}${s}%`;
}

/** Variación porcentual de `desde` a `hasta`. */
export const variacion = (desde, hasta) =>
  !desde || !hasta ? null : ((hasta - desde) / desde) * 100;

export const flecha = (n) => (n == null || Math.abs(n) < 0.005 ? '=' : n > 0 ? '▲' : '▼');
