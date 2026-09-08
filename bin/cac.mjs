#!/usr/bin/env node
// Revisa el índice CAC y avisa una sola vez por mes, cuando aparece un período nuevo.
import { ultimoCac } from '../src/fuentes/cac.js';
import { mailCac } from '../src/plantillas.js';
import { avisar } from '../src/notificar.js';
import { leerEstado, guardarEstado, leerCac, guardarCac } from '../src/estado.js';

const forzar = process.env.FORZAR === '1';
const cac = await ultimoCac();
const estado = leerEstado();

if (cac.discrepancia) console.warn(`⚠️  Las fuentes no coinciden en el período: ${cac.discrepancia}`);

if (cac.variacion.general == null && cac.indice.general == null) {
  console.error('El período se leyó pero sin ningún número utilizable; probablemente cambió el HTML de la fuente.');
  process.exit(1);
}

if (estado.cac?.clave === cac.clave && !forzar) {
  console.log(`Sin novedades: el último CAC publicado sigue siendo ${cac.periodo}. Próxima publicación: ${cac.proximaPublicacion ?? 'sin dato'}.`);
  process.exit(0);
}

const aviso = mailCac(cac);
const { enviados, errores, seco } = await avisar('cac', aviso);

if (!seco) {
  estado.cac = { clave: cac.clave, periodo: cac.periodo, avisado: new Date().toISOString() };
  guardarEstado(estado);
  const serie = leerCac().filter((c) => c.clave !== cac.clave);
  serie.push(cac);
  serie.sort((a, b) => a.clave.localeCompare(b.clave));
  guardarCac(serie);
}

console.log(`CAC ${cac.periodo} avisado · ${enviados} envío(s)`);
if (errores.length) {
  console.error('Errores de envío:\n- ' + errores.join('\n- '));
  process.exit(1);
}
