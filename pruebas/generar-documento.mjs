/* Genera los documentos de prueba FICTICIOS con Node (Lecturas o, con --doctrina, la Doctrina).
   Uso:  JSZIP=/ruta/a/jszip node pruebas/generar-documento.mjs [salida.docx] [--version2 | --sin-estructura]
   (JSZIP apunta a una copia local de jszip@3.10.1/dist/jszip.min.js; también
   puedes descargarlo desde pruebas/index.html con el botón del navegador.) */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { generarDocumento } from './generador.js';

const require = createRequire(import.meta.url);
const JSZip = require(process.env.JSZIP || 'jszip');
const args = process.argv.slice(2);
const salida = args.find(a => !a.startsWith('--')) || 'pruebas/FICTICIO-documento-de-prueba.docx';
if (args.includes('--doctrina')) {
  const { generarDoctrina } = await import('./generador-doctrina.js');
  const op = { insertarCristologia: args.includes('--version2'), insertarCronica: args.includes('--version2'), modificarLogos: args.includes('--version2') };
  const ruta = args.find(a => !a.startsWith('--')) || 'pruebas/FICTICIO-doctrina-de-prueba.docx';
  writeFileSync(ruta, await generarDoctrina(JSZip, op));
  console.log('Escrito', ruta);
  process.exit(0);
}
const opciones = args.includes('--version2')
  ? { conjuntos: 372, modificar: [{ tipo: 'lectura', numero: 12 }, { tipo: 'evangelio', numero: 300 }] }
  : args.includes('--sin-estructura') ? { sinEstructura: true } : {};
writeFileSync(salida, await generarDocumento(JSZip, opciones));
console.log('Escrito', salida);
