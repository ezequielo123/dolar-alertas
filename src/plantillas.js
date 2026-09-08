import { pesos, pesosCorto, pct, flecha, fechaHoraAR, fechaLargaAR, variacion } from './lib/fmt.js';

const AZUL = '#0f172a', GRIS = '#64748b', BORDE = '#e2e8f0', VERDE = '#059669', ROJO = '#dc2626';
const color = (v) => (v == null || Math.abs(v) < 0.005 ? GRIS : v > 0 ? ROJO : VERDE); // sube el dólar = rojo

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Envoltorio HTML común a todos los mails. */
function marco({ titulo, bajada, cuerpo, pie }) {
  return `<!doctype html><html lang="es-AR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${AZUL}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid ${BORDE};border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 24px 6px">
  <div style="font-size:19px;font-weight:700;letter-spacing:-.01em">${esc(titulo)}</div>
  <div style="font-size:13px;color:${GRIS};margin-top:4px">${esc(bajada)}</div>
</td></tr>
<tr><td style="padding:12px 24px 20px">${cuerpo}</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid ${BORDE};font-size:11px;color:${GRIS};line-height:1.6">${pie}</td></tr>
</table></body></html>`;
}

/** Fila de una casa de cambio con compra, venta y variación. */
function filaCotizacion({ etiqueta, compra, venta, varia, notaVaria }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0;border:1px solid ${BORDE};border-radius:10px">
  <tr><td style="padding:14px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${GRIS};font-weight:600">${esc(etiqueta)}</div>
    <div style="font-size:26px;font-weight:700;margin-top:6px;letter-spacing:-.02em">${pesosCorto(venta)}</div>
    <div style="font-size:12px;color:${GRIS};margin-top:2px">compra ${pesos(compra)} &nbsp;·&nbsp; venta ${pesos(venta)}</div>
    ${varia == null ? '' : `<div style="font-size:13px;font-weight:600;color:${color(varia)};margin-top:8px">${flecha(varia)} ${pct(varia)} <span style="font-weight:400;color:${GRIS}">${esc(notaVaria ?? '')}</span></div>`}
  </td></tr></table>`;
}

const bloqueBrecha = (brecha) =>
  `<div style="font-size:13px;color:${GRIS};padding:10px 16px;background:#f8fafc;border-radius:10px">
     Brecha blue / oficial: <strong style="color:${AZUL}">${pct(brecha, 1)}</strong>
   </div>`;

const pieEstandar = (cot) =>
  `Fuente: ${esc(cot.fuente)} · dólar oficial y blue.<br>Consultado el ${esc(fechaHoraAR())} (hora de Argentina).<br>
   Aviso automático de <strong>dolar-alertas</strong>.`;

// ─── Apertura y cierre ────────────────────────────────────────────────────────

export function mailDiario({ momento, cot, referencia }) {
  const esApertura = momento === 'apertura';
  const titulo = esApertura ? 'Dólar hoy — apertura' : 'Dólar hoy — cierre';
  const nota = esApertura ? 'vs. cierre anterior' : 'vs. apertura de hoy';
  const vOf = referencia ? variacion(referencia.oficial, cot.oficial.venta) : null;
  const vBl = referencia ? variacion(referencia.blue, cot.blue.venta) : null;

  const cuerpo =
    filaCotizacion({ etiqueta: 'Oficial', compra: cot.oficial.compra, venta: cot.oficial.venta, varia: vOf, notaVaria: nota })
    + filaCotizacion({ etiqueta: 'Blue', compra: cot.blue.compra, venta: cot.blue.venta, varia: vBl, notaVaria: nota })
    + bloqueBrecha(cot.brecha);

  const texto = [
    `${esApertura ? '🟢 APERTURA' : '🔴 CIERRE'} · ${fechaLargaAR()}`,
    '',
    `Oficial: ${pesosCorto(cot.oficial.venta)} (compra ${pesosCorto(cot.oficial.compra)})${vOf == null ? '' : `  ${flecha(vOf)} ${pct(vOf)}`}`,
    `Blue:    ${pesosCorto(cot.blue.venta)} (compra ${pesosCorto(cot.blue.compra)})${vBl == null ? '' : `  ${flecha(vBl)} ${pct(vBl)}`}`,
    `Brecha:  ${pct(cot.brecha, 1)}`,
    referencia ? `(variación ${nota})` : null,
    `— ${fechaHoraAR()}`,
  ].filter((l) => l !== null).join('\n');

  return {
    asunto: `${esApertura ? '🟢' : '🔴'} Dólar ${esApertura ? 'apertura' : 'cierre'} — oficial ${pesosCorto(cot.oficial.venta)} · blue ${pesosCorto(cot.blue.venta)}`,
    html: marco({ titulo, bajada: `${fechaLargaAR()} · ${esApertura ? 'apertura del mercado' : 'cierre del mercado'}`, cuerpo, pie: pieEstandar(cot) }),
    texto,
    wa: {
      titulo: `dólar — ${esApertura ? 'apertura' : 'cierre'}`,
      resumen: `Oficial ${pesosCorto(cot.oficial.venta)}${vOf == null ? '' : ` (${flecha(vOf)} ${pct(vOf)})`} · Blue ${pesosCorto(cot.blue.venta)}${vBl == null ? '' : ` (${flecha(vBl)} ${pct(vBl)})`} · Brecha ${pct(cot.brecha, 1)}`,
      momento: fechaHoraAR(),
    },
  };
}

// ─── Salto intradiario ────────────────────────────────────────────────────────

export function mailSalto({ saltos, cot, ancla }) {
  const detalle = saltos.map((s) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0;border:1px solid ${BORDE};border-left:4px solid ${color(s.pct)};border-radius:10px">
      <tr><td style="padding:14px 16px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${GRIS};font-weight:600">${esc(s.etiqueta)}</div>
        <div style="font-size:22px;font-weight:700;margin-top:6px">${pesosCorto(s.de)} → ${pesosCorto(s.a)}</div>
        <div style="font-size:14px;font-weight:600;color:${color(s.pct)};margin-top:6px">${flecha(s.pct)} ${pct(s.pct)} <span style="font-weight:400;color:${GRIS}">desde ${esc(s.desde)}</span></div>
      </td></tr></table>`).join('');

  const cuerpo = `<div style="font-size:14px;line-height:1.6;margin-bottom:4px">
      Movimiento fuerte en lo que va del día.</div>${detalle}${bloqueBrecha(cot.brecha)}`;

  const texto = [
    '⚡ SALTO DEL DÓLAR',
    '',
    ...saltos.map((s) => `${s.etiqueta}: ${pesosCorto(s.de)} → ${pesosCorto(s.a)}  ${flecha(s.pct)} ${pct(s.pct)} (desde ${s.desde})`),
    '',
    `Oficial ${pesosCorto(cot.oficial.venta)} · Blue ${pesosCorto(cot.blue.venta)} · brecha ${pct(cot.brecha, 1)}`,
    `— ${fechaHoraAR()}`,
  ].join('\n');

  const peor = saltos.reduce((a, b) => (Math.abs(b.pct) > Math.abs(a.pct) ? b : a));
  return {
    asunto: `⚡ Salto del ${peor.etiqueta.toLowerCase()}: ${pct(peor.pct)} → ${pesosCorto(peor.a)}`,
    html: marco({ titulo: '⚡ Salto del dólar', bajada: `${fechaLargaAR()} · aviso intradiario`, cuerpo, pie: pieEstandar(cot) }),
    texto,
    wa: {
      titulo: 'salto del dólar',
      resumen: saltos.map((s2) => `${s2.etiqueta} ${pesosCorto(s2.de)} → ${pesosCorto(s2.a)} (${flecha(s2.pct)} ${pct(s2.pct)})`).join(' · '),
      momento: fechaHoraAR(),
    },
  };
}

// ─── Índice CAC ───────────────────────────────────────────────────────────────

export function mailCac(cac) {
  const fila = (etiqueta, indice, varia) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDE};font-size:14px">${esc(etiqueta)}</td>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDE};font-size:14px;text-align:right;font-weight:600">${indice == null ? '—' : indice.toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDE};font-size:14px;text-align:right;font-weight:600;color:${color(varia)}">${varia == null ? '—' : `${flecha(varia)} ${pct(varia)}`}</td>
    </tr>`;

  const cuerpo = `
    <div style="font-size:13px;color:${GRIS};line-height:1.6;margin-bottom:10px">
      Índice del costo de la construcción de la Cámara Argentina de la Construcción (CAMARCO).
      Se publica una vez por mes y es el que se usa para actualizar contratos de obra.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0">
      <tr>
        <th style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${GRIS};padding-bottom:6px">Serie</th>
        <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${GRIS};padding-bottom:6px">Índice</th>
        <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${GRIS};padding-bottom:6px">Mensual</th>
      </tr>
      ${fila('Nivel general', cac.indice.general, cac.variacion.general)}
      ${fila('Materiales', cac.indice.materiales, cac.variacion.materiales)}
      ${fila('Mano de obra', cac.indice.manoDeObra, cac.variacion.manoDeObra)}
    </table>
    ${cac.interanual == null ? '' : `<div style="font-size:13px;color:${GRIS};padding:10px 16px;background:#f8fafc;border-radius:10px;margin-top:12px">Variación interanual del nivel general: <strong style="color:${AZUL}">${pct(cac.interanual, 1)}</strong></div>`}
    ${cac.proximaPublicacion ? `<div style="font-size:12px;color:${GRIS};margin-top:12px">Próxima publicación: ${esc(cac.proximaPublicacion)}.</div>` : ''}`;

  const texto = [
    `🏗️ ÍNDICE CAC — ${cac.periodo}`,
    '',
    `Nivel general: ${cac.indice.general?.toLocaleString('es-AR') ?? '—'}  ${cac.variacion.general == null ? '' : `${flecha(cac.variacion.general)} ${pct(cac.variacion.general)}`}`,
    `Materiales:    ${cac.indice.materiales?.toLocaleString('es-AR') ?? '—'}  ${cac.variacion.materiales == null ? '' : `${flecha(cac.variacion.materiales)} ${pct(cac.variacion.materiales)}`}`,
    `Mano de obra:  ${cac.indice.manoDeObra?.toLocaleString('es-AR') ?? '—'}  ${cac.variacion.manoDeObra == null ? '' : `${flecha(cac.variacion.manoDeObra)} ${pct(cac.variacion.manoDeObra)}`}`,
    cac.interanual == null ? null : `Interanual:    ${pct(cac.interanual, 1)}`,
    '',
    cac.proximaPublicacion ? `Próxima publicación: ${cac.proximaPublicacion}` : null,
  ].filter((l) => l !== null).join('\n');

  return {
    asunto: `🏗️ Índice CAC ${cac.periodo}: ${pct(cac.variacion.general)} mensual`,
    html: marco({
      titulo: `Índice CAC — ${cac.periodo}`,
      bajada: 'Costo de la construcción en Argentina · dato mensual',
      cuerpo,
      pie: `Fuentes: ${esc(cac.fuentes.join(', '))} (réplicas del informe de CAMARCO).<br>Aviso automático de <strong>dolar-alertas</strong>.`,
    }),
    texto,
    wa: {
      titulo: `índice CAC de ${cac.periodo}`,
      resumen: `General ${pct(cac.variacion.general)}${cac.indice.general == null ? '' : ` (${cac.indice.general.toLocaleString('es-AR')})`} · Materiales ${pct(cac.variacion.materiales)} · Mano de obra ${pct(cac.variacion.manoDeObra)}${cac.interanual == null ? '' : ` · Interanual ${pct(cac.interanual, 1)}`}`,
      momento: fechaHoraAR(),
    },
  };
}
