/* Servidores locales para las pruebas de extremo a extremo:
   - la app (HTTP, carpeta del repositorio; se puede cambiar en caliente
     con cambiarRaiz() para probar la actualización de una versión a otra)
   - opcional: un espejo HTTPS de cdn.jsdelivr.net y huggingface.co
     (ver preparar-espejo.sh). Registra cada petición para comprobar
     que nunca se envía el texto del documento. */
import http from 'node:http';
import https from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function manejador(raizDe, registro) {
  return async (req, res) => {
    let cuerpo = 0;
    req.on('data', c => { cuerpo += c.length; });
    await new Promise(ok => req.on('end', ok));
    const host = (req.headers.host || '').split(':')[0];
    const url = new URL(req.url, 'http://x');
    registro.push({ host, metodo: req.method, ruta: url.pathname, bytesCuerpo: cuerpo, t: Date.now() });
    const raiz = raizDe(host);
    let ruta = decodeURIComponent(url.pathname);
    let archivo = path.join(raiz, ruta);
    if (!archivo.startsWith(raiz)) { res.writeHead(403).end(); return; }
    try {
      let s = await stat(archivo);
      if (s.isDirectory()) { archivo = path.join(archivo, 'index.html'); s = await stat(archivo); }
      const datos = await readFile(archivo);
      const ext = path.extname(archivo) || (ruta.endsWith('/+esm') ? '.js' : '');
      res.writeHead(200, {
        'Content-Type': TIPOS[ext] || (ruta.endsWith('+esm') ? TIPOS['.js'] : 'application/octet-stream'),
        'Content-Length': datos.length, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : datos);
    } catch {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end('no encontrado');
    }
  };
}

export async function iniciar({ raizApp, espejo = null, puertoApp = 8080, puertoEspejo = 443 }) {
  const registro = [];
  const estado = { raiz: raizApp };
  const app = http.createServer(manejador(() => estado.raiz, registro));
  await new Promise(ok => app.listen(puertoApp, '127.0.0.1', ok));
  let seguro = null;
  if (espejo) {
    seguro = https.createServer({ key: readFileSync(path.join(espejo, 'clave.pem')), cert: readFileSync(path.join(espejo, 'cert.pem')) },
      manejador(host => path.join(espejo, host), registro));
    await new Promise(ok => seguro.listen(puertoEspejo, '127.0.0.1', ok));
  }
  const cerrar = async () => {
    for (const s of [app, seguro]) if (s) { s.closeAllConnections?.(); await new Promise(ok => s.close(ok)); }
  };
  return { registro, cerrar, cambiarRaiz: r => { estado.raiz = r; } };
}
