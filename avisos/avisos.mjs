/* Avisos de carga del parte diario, por la API oficial de WhatsApp.
 *
 * A las 18:30 de Peru escribe a los supervisores para que carguen el avance, y
 * luego, cada hora, escribe SOLO a quien le falte alguna especialidad. Con un
 * parte cargado del dia ya cuenta: no se le vuelve a escribir por esa.
 *
 * POR QUE NO HAY MENSAJE AL GRUPO
 * La Cloud API de Meta no expone los grupos: solo permite escribir de uno a uno
 * a numeros que hayan aceptado. No es una limitacion de este programa: no hay
 * forma de mandar a un grupo por la via oficial. El aviso de las 18:30 sale por
 * tanto a cada supervisor por separado.
 *
 * POR QUE PLANTILLAS Y NO TEXTO LIBRE
 * Para escribir PRIMERO -fuera de las 24 h desde el ultimo mensaje de esa
 * persona- Meta exige una plantilla aprobada. Por eso los mensajes van como
 * plantilla con variables y no como texto suelto.
 *
 * POR DEFECTO NO ENVIA NADA: imprime lo que mandaria. Para enviar de verdad,
 * arrancar con --enviar.
 *
 * USO
 *   node avisos.mjs --ahora             que le falta a cada uno hoy
 *   node avisos.mjs --ahora=2026-08-19  lo mismo contra un dia pasado
 *   node avisos.mjs --prueba=51999...   manda UNA plantilla a ese numero
 *   node avisos.mjs                     de guardia, en seco
 *   node avisos.mjs --enviar            de guardia, enviando
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
/* config.json lleva telefonos y no se sube al repo: si no esta, se crea a
   partir del ejemplo para que el primer arranque no falle por eso. */
const RUTA_CFG = path.join(AQUI, 'config.json');
if (!fs.existsSync(RUTA_CFG))
  fs.copyFileSync(path.join(AQUI, 'config.ejemplo.json'), RUTA_CFG);
const CFG = JSON.parse(fs.readFileSync(RUTA_CFG, 'utf8'));
const REGISTRO = path.join(AQUI, 'enviados.json');

const SUPA = 'https://mytrrdjiqtznkiizqehh.supabase.co/rest/v1';
const CLAVE = 'sb_publishable_GxNitjiHu8LMBaPdGa4fRA_rwE-THDq';

/* El token NUNCA en un fichero del repo. Sale del entorno y, si no, de
   secreto.json, que esta excluido del control de versiones. */
function secreto(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  try {
    const s = JSON.parse(fs.readFileSync(path.join(AQUI, 'secreto.json'), 'utf8'));
    return s[nombre] || '';
  } catch { return '' }
}
const WA_TOKEN = secreto('WA_TOKEN');
const WA_PHONE_ID = secreto('WA_PHONE_ID');
const WA_API = 'https://graph.facebook.com/v21.0';

const ARG = process.argv.slice(2);
const tiene = (a) => ARG.some(x => x === a || x.startsWith(a + '='));
const valor = (a) => (ARG.find(x => x.startsWith(a + '=')) || '').split('=')[1] || '';
const ENVIA = tiene('--enviar');

/* Peru no cambia la hora en todo el ano, asi que UTC-5 vale siempre y no hay
   que arrastrar una libreria de husos para esto. */
const PERU_MIN = -5 * 60;
function peru() {
  const d = new Date(Date.now() + PERU_MIN * 60000);
  return {
    fecha: d.toISOString().slice(0, 10),
    hhmm: d.toISOString().slice(11, 16),
    texto: d.toISOString().slice(0, 16).replace('T', ' ')
  };
}
const log = (...a) => console.log('[' + peru().texto + ']', ...a);

/* ---------- quien ha cargado ese dia ---------- */
async function cargadoEl(fecha) {
  const q = new URLSearchParams({
    select: 'disciplina,supervisor,cuadre',
    proyecto: 'eq.' + CFG.proyecto,
    fecha: 'eq.' + fecha,
    limit: '5000'
  });
  const r = await fetch(SUPA + '/partes?' + q, {
    headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE }
  });
  if (!r.ok) throw new Error('Supabase respondio ' + r.status);
  const hecho = new Set();
  for (const f of await r.json()) {
    if (f.cuadre) continue;   /* un cuadre es un ajuste, no la carga del dia */
    hecho.add((f.supervisor || '').trim().toLowerCase() + '|' +
              (f.disciplina || '').trim().toLowerCase());
  }
  return hecho;
}

async function quienFalta(dia) {
  const fecha = dia || peru().fecha;
  const hecho = await cargadoEl(fecha);
  const faltan = [];
  for (const s of (CFG.supervisores || [])) {
    /* aqui NO se descarta a quien no tiene telefono: si se descartara, el
       diagnostico diria «no falta nadie» justo cuando falta un dato */
    const pend = (s.disciplinas || []).filter(d =>
      !hecho.has((s.nombre || '').trim().toLowerCase() + '|' + d.trim().toLowerCase()));
    if (pend.length) faltan.push({ ...s, pendientes: pend });
  }
  return { fecha, faltan, hecho };
}

/* ---------- el registro, para no repetir ---------- */
const leeRegistro = () => {
  try { return JSON.parse(fs.readFileSync(REGISTRO, 'utf8')) } catch { return {} }
};
function apunta(clave) {
  const r = leeRegistro();
  r[clave] = new Date().toISOString();
  const corte = Date.now() - 30 * 864e5;   /* es un registro, no un archivo */
  for (const k of Object.keys(r)) if (Date.parse(r[k]) < corte) delete r[k];
  fs.writeFileSync(REGISTRO, JSON.stringify(r, null, 1));
}

/* ---------- la API de WhatsApp ---------- */
const soloDigitos = (t) => String(t).replace(/\D/g, '');

async function mandaPlantilla(tel, plantilla, params) {
  const destino = soloDigitos(tel);
  if (!ENVIA) {
    console.log('   (en seco) ->', destino, '·', plantilla, '·', JSON.stringify(params));
    return { seco: true };
  }
  if (!WA_TOKEN || !WA_PHONE_ID)
    throw new Error('faltan WA_TOKEN o WA_PHONE_ID (ver LEEME.md)');
  const cuerpo = {
    messaging_product: 'whatsapp',
    to: destino,
    type: 'template',
    template: {
      name: plantilla,
      language: { code: CFG.idiomaPlantilla || 'es' },
      components: params.length
        ? [{ type: 'body',
             parameters: params.map(t => ({ type: 'text', text: String(t) })) }]
        : []
    }
  };
  const r = await fetch(WA_API + '/' + WA_PHONE_ID + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + WA_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('WhatsApp ' + r.status + ': ' +
    String(j?.error?.message || JSON.stringify(j)).slice(0, 200));
  log('enviado a', destino, '·', (j.messages && j.messages[0] && j.messages[0].id) || '');
  return j;
}

const dmy = (f) => f.split('-').reverse().join('/');

/* ---------- lo que toca a cada hora ---------- */
async function tocaArranque() {
  const { fecha, faltan } = await quienFalta();
  const reg = leeRegistro();
  for (const s of (CFG.supervisores || [])) {
    if (!s.telefono) { log('sin telefono en config.json:', s.nombre); continue }
    const clave = 'arranque|' + s.nombre + '|' + fecha;
    if (reg[clave]) continue;
    await mandaPlantilla(s.telefono, CFG.plantillaArranque, [s.nombre, dmy(fecha)]);
    if (ENVIA) apunta(clave);
  }
  log('a esta hora faltan:',
    faltan.length ? faltan.map(f => f.nombre).join(', ') : 'nadie');
}

async function tocaRecuerdo() {
  const { fecha, faltan } = await quienFalta();
  if (!faltan.length) { log('nadie pendiente: no se escribe a nadie'); return }
  const reg = leeRegistro();
  for (const s of faltan) {
    if (!s.telefono) { log('sin telefono en config.json:', s.nombre); continue }
    /* una vez por persona, especialidad y hora: si ya se le escribio en este
       pase, no se insiste */
    const clave = [s.nombre, s.pendientes.join('+'), fecha, peru().hhmm].join('|');
    if (reg[clave]) continue;
    await mandaPlantilla(s.telefono, CFG.plantillaRecuerdo,
      [s.nombre, dmy(fecha), s.pendientes.join(' y ')]);
    if (ENVIA) apunta(clave);
  }
}

/* ---------- el reloj ---------- */
function deGuardia() {
  log('de guardia.', ENVIA ? 'ENVIANDO de verdad.' : 'En seco: no envia, solo ensena.');
  log('horas de Peru:', [CFG.horaArranque, ...(CFG.horasRecuerdo || [])].join(', '));
  let ultima = '';
  setInterval(async () => {
    const { hhmm } = peru();
    if (hhmm === ultima) return;
    ultima = hhmm;
    try {
      if (hhmm === CFG.horaArranque) await tocaArranque();
      else if ((CFG.horasRecuerdo || []).includes(hhmm)) await tocaRecuerdo();
    } catch (e) { log('⚠', e.message) }
  }, 20000);
}

/* ---------- arranque ---------- */
const main = async () => {
  if (tiene('--ahora')) {
    const { fecha, faltan, hecho } = await quienFalta(valor('--ahora'));
    console.log('Fecha en Peru:', fecha);
    console.log('Cargas de ese dia:', hecho.size ? [...hecho].join(', ') : 'ninguna');
    console.log('Pendientes:');
    if (!faltan.length) console.log('   nadie');
    for (const s of faltan)
      console.log('   ' + s.nombre + ' -> ' + s.pendientes.join(', ') +
        (s.telefono ? '' : '   (SIN TELEFONO en config.json)'));
    return;
  }
  if (tiene('--prueba')) {
    const tel = valor('--prueba');
    if (!tel) throw new Error('dime a que numero: --prueba=51999888777');
    await mandaPlantilla(tel, CFG.plantillaArranque, ['Prueba', dmy(peru().fecha)]);
    return;
  }
  deGuardia();
};

main().catch(e => { console.error('⚠', e.message); process.exit(1) });
