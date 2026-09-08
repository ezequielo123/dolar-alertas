#!/usr/bin/env node
// Vigila saltos fuertes dentro del día y avisa cuando se pasa el umbral.
import { cotizaciones } from '../src/fuentes/dolar.js';
import { mailSalto } from '../src/plantillas.js';
import { avisar } from '../src/notificar.js';
import { leerEstado, guardarEstado, anotarHistorial, config } from '../src/estado.js';
import { hoyAR, fechaHoraAR, esDiaHabil, variacion } from '../src/lib/fmt.js';

const forzar = process.env.FORZAR === '1';
if (!esDiaHabil() && !forzar) {
  console.log('Fin de semana: no se vigila.');
  process.exit(0);
}

const { saltos: reglas } = config();
const fecha = hoyAR();
const cot = await cotizaciones();
const estado = leerEstado();

anotarHistorial(fecha, 'intradia', cot);

// Sin ancla del día (por ejemplo si falló la apertura) se fija una y se sale:
// nunca se avisa contra una referencia de otra rueda.
if (!estado.ancla || estado.ancla.fecha !== fecha) {
  estado.ancla = { fecha, hora: fechaHoraAR(), oficial: cot.oficial.venta, blue: cot.blue.venta, motivo: 'primera lectura del día' };
  estado.saltos = [];
  guardarEstado(estado);
  console.log('Ancla del día fijada, sin comparación previa.');
  process.exit(0);
}

if (estado.saltos.length >= reglas.maximoPorDia) {
  console.log(`Ya se avisaron ${estado.saltos.length} saltos hoy (tope ${reglas.maximoPorDia}).`);
  process.exit(0);
}

const ultimo = estado.saltos.at(-1);
if (ultimo) {
  const minutos = (Date.now() - new Date(ultimo.momento).getTime()) / 60000;
  if (minutos < reglas.minutosEntreAvisos) {
    console.log(`Último aviso hace ${Math.round(minutos)} min (mínimo ${reglas.minutosEntreAvisos}).`);
    process.exit(0);
  }
}

const candidatos = [
  { casa: 'oficial', etiqueta: 'Oficial', umbral: reglas.umbralOficial, de: estado.ancla.oficial, a: cot.oficial.venta },
  { casa: 'blue', etiqueta: 'Blue', umbral: reglas.umbralBlue, de: estado.ancla.blue, a: cot.blue.venta },
].map((c) => ({ ...c, pct: variacion(c.de, c.a), desde: estado.ancla.hora }))
  .filter((c) => c.pct != null && Math.abs(c.pct) >= c.umbral);

if (!candidatos.length) {
  console.log(`Sin saltos. Oficial ${cot.oficial.venta} / blue ${cot.blue.venta} (ancla ${estado.ancla.oficial}/${estado.ancla.blue}).`);
  process.exit(0);
}

const aviso = mailSalto({ saltos: candidatos, cot, ancla: estado.ancla });
const { enviados, errores, seco } = await avisar('salto', aviso);

if (!seco) {
  estado.saltos.push({
    momento: new Date().toISOString(),
    hora: fechaHoraAR(),
    detalle: candidatos.map((c) => ({ casa: c.casa, de: c.de, a: c.a, pct: Number(c.pct.toFixed(2)) })),
  });
  // Se re-ancla en el valor actual: el próximo aviso mide el salto siguiente, no el mismo otra vez.
  estado.ancla = { fecha, hora: fechaHoraAR(), oficial: cot.oficial.venta, blue: cot.blue.venta, motivo: 'después de un salto' };
  guardarEstado(estado);
}

console.log(`Salto avisado: ${candidatos.map((c) => `${c.casa} ${c.pct.toFixed(2)}%`).join(', ')} · ${enviados} envío(s)`);
if (errores.length) {
  console.error('Errores de envío:\n- ' + errores.join('\n- '));
  process.exit(1);
}
