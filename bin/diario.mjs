#!/usr/bin/env node
// Aviso de apertura o de cierre.  Uso: node bin/diario.mjs apertura|cierre
import { cotizaciones } from '../src/fuentes/dolar.js';
import { mailDiario } from '../src/plantillas.js';
import { avisar } from '../src/notificar.js';
import { leerEstado, guardarEstado, anotarHistorial } from '../src/estado.js';
import { hoyAR, fechaHoraAR, esDiaHabil } from '../src/lib/fmt.js';

const momento = process.argv[2];
if (!['apertura', 'cierre'].includes(momento)) {
  console.error('Uso: node bin/diario.mjs apertura|cierre');
  process.exit(2);
}

const forzar = process.env.FORZAR === '1';
if (!esDiaHabil() && !forzar) {
  console.log('Fin de semana: no hay mercado, no se avisa.');
  process.exit(0);
}

const fecha = hoyAR();
const cot = await cotizaciones();
const estado = leerEstado();

// La apertura se compara contra el cierre anterior; el cierre, contra la apertura de hoy.
const referencia = momento === 'apertura'
  ? estado.cierre
  : (estado.apertura?.fecha === fecha ? estado.apertura : estado.cierre);

const aviso = mailDiario({ momento, cot, referencia });
const { enviados, errores, seco } = await avisar(momento, aviso);

const punto = { fecha, hora: fechaHoraAR(), oficial: cot.oficial.venta, blue: cot.blue.venta };
if (momento === 'apertura') {
  estado.apertura = punto;
  // Nueva rueda: el ancla de los saltos arranca en la apertura y se limpian los avisos del día.
  estado.ancla = { ...punto, motivo: 'apertura' };
  estado.saltos = [];
} else {
  estado.cierre = punto;
}

if (!seco) {
  guardarEstado(estado);
  anotarHistorial(fecha, momento, cot);
}

console.log(`${momento}: oficial ${cot.oficial.venta} / blue ${cot.blue.venta} · ${enviados} envío(s)`);
if (errores.length) {
  console.error('Errores de envío:\n- ' + errores.join('\n- '));
  process.exit(1);
}
