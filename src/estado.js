import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = join(RAIZ, 'data');

const leer = (archivo, porDefecto) => {
  try {
    return JSON.parse(readFileSync(join(DATOS, archivo), 'utf8'));
  } catch {
    return porDefecto;
  }
};

const escribir = (archivo, valor) => {
  mkdirSync(DATOS, { recursive: true });
  writeFileSync(join(DATOS, archivo), JSON.stringify(valor, null, 2) + '\n');
};

export const ESTADO_VACIO = {
  apertura: null,      // { fecha, oficial, blue, hora }
  cierre: null,        // { fecha, oficial, blue, hora }
  ancla: null,         // referencia contra la que se miden los saltos del día
  saltos: [],          // saltos avisados hoy
  cac: null,           // { clave, avisado }
};

export const leerEstado = () => ({ ...ESTADO_VACIO, ...leer('estado.json', {}) });
export const guardarEstado = (e) => escribir('estado.json', e);

export const leerHistorial = () => leer('historial.json', []);
export const guardarHistorial = (h) => escribir('historial.json', h);

export const leerCac = () => leer('cac.json', []);
export const guardarCac = (c) => escribir('cac.json', c);

export const config = () => JSON.parse(readFileSync(join(RAIZ, 'config.json'), 'utf8'));

/**
 * Guarda un punto del día en el historial (una fila por fecha, se va completando).
 * `momento` es 'apertura' | 'cierre' | 'intradia'.
 */
export function anotarHistorial(fecha, momento, cot) {
  const hist = leerHistorial();
  let fila = hist.find((f) => f.fecha === fecha);
  if (!fila) { fila = { fecha }; hist.push(fila); }
  if (momento === 'apertura') {
    fila.aperturaOficial = cot.oficial.venta;
    fila.aperturaBlue = cot.blue.venta;
  }
  if (momento === 'cierre') {
    fila.cierreOficial = cot.oficial.venta;
    fila.cierreBlue = cot.blue.venta;
  }
  fila.oficialCompra = cot.oficial.compra;
  fila.oficialVenta = cot.oficial.venta;
  fila.blueCompra = cot.blue.compra;
  fila.blueVenta = cot.blue.venta;
  fila.brecha = Number(cot.brecha.toFixed(2));
  hist.sort((a, b) => a.fecha.localeCompare(b.fecha));
  guardarHistorial(hist.slice(-800)); // ~3 años de días hábiles
  return fila;
}
