/**
 * Un test por cada fallo de la batería de pruebas en producción del 20 nov 2026 (M1–M4, B1–B12).
 * Todos fallan con el código de f99e2a6 y pasan con el arreglo.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import casosJson from "../datos/casos.json";
import { corregir } from "../shared/puntuacion";
import { anadirAlGrupo, csvGrupo, esIntento, exportar, grupoVacio, intentoDesde, leerExportacion, progresoVacio, sanearBorrador, seudonimoValido, type Intento } from "../shared/progreso";
import { MAX_INTENTOS_ARCHIVO } from "../shared/limites";
import { corregirPeticion, recorregirLote } from "../shared/servidor";
import { noEncontrado, segunMetodo } from "../shared/http";
import type { Caso, Lectura } from "../shared/tipos";
import { leerRuta, rutaPropia } from "../src/ruta";
import { lejosDeLaGlandula } from "../src/zonas";
import { cargarArchivosDocente, prepararExportacion, recuperarCopia, SIN_ESPACIO, type ArchivoEntrada } from "../src/archivos";
import { almacen } from "../src/almacen";

const casos = casosJson as Caso[];
const c = casos.find((x) => x.id === "10807_1000823")!;
const lectura: Lectura = { psad: 0.17, lesiones: [], categoria: 5, decision: "c", impresion: "" };
const intento = (id: string, extra: Partial<Intento> = {}): Intento => ({ ...intentoDesde(c.id, lectura, corregir(c, lectura), 60), id, ...extra });
const archivo = (name: string, texto: string): ArchivoEntrada => ({ name, size: Buffer.byteLength(texto), text: async () => texto });
const exportacion = (seudonimo: string, intentos: Intento[]) => exportar({ ...progresoVacio(), seudonimo, intentos });
const recorregirOk = async (xs: Array<{ caso: string; lectura: Lectura }>) =>
  xs.map((x) => { const r = corregir(casos.find((k) => k.id === x.caso)!, x.lectura); return { nota: r.nota, critico: r.critico, perfecto: r.perfecto, componentes: {} }; });

/** localStorage de mentira con cuota en caracteres (como el del navegador, unos 5 MB). */
class AlmacenFalso {
  datos = new Map<string, string>();
  constructor(public cuota = Infinity) {}
  getItem(k: string) { return this.datos.get(k) ?? null; }
  setItem(k: string, v: string) {
    const total = [...this.datos].reduce((s, [kk, vv]) => s + (kk === k ? 0 : kk.length + vv.length), 0) + k.length + v.length;
    if (total > this.cuota) throw new Error("QuotaExceededError");
    this.datos.set(k, v);
  }
  removeItem(k: string) { this.datos.delete(k); }
}
const ponerAlmacen = (a: AlmacenFalso) => Object.defineProperty(globalThis, "localStorage", { value: a, configurable: true, writable: true });
beforeEach(() => ponerAlmacen(new AlmacenFalso()));

test("M1: si la copia no cabe en el almacén, no se anuncia como recuperada", async () => {
  ponerAlmacen(new AlmacenFalso(500));
  const r = await recuperarCopia(archivo("copia.json", exportacion("R2", [intento("a"), intento("b"), intento("c")])), [c.id]);
  assert.equal(r.ok, false);
  assert.equal(r.mensaje, SIN_ESPACIO);
  assert.equal(almacen.progreso().intentos.length, 0);
  // Panel docente: tampoco dice «N intentos de …» si no se ha guardado.
  const avisos = await cargarArchivosDocente([archivo("a.json", exportacion("R2", [intento("a"), intento("b"), intento("c")]))], recorregirOk);
  assert.ok(!avisos.some((a) => / intentos de «/.test(a)), avisos.join("\n"));
  assert.ok(avisos.some((a) => a.startsWith(SIN_ESPACIO)));
  // Y un archivo enorme se rechaza antes de leerlo.
  const enorme = { name: "enorme.json", size: 9_000_000, text: async () => { throw new Error("no debería leerse"); } };
  assert.equal((await recuperarCopia(enorme, null)).ok, false);
});

test("M2: un borrador dañado o de otro formato se descarta (el caso no se queda en blanco)", () => {
  for (const malo of [123, null, "x", { paso: 2 }, { lectura: null, paso: 2, segundos: 0 },
    { lectura: { psad: "x", lesiones: "x", categoria: 9, decision: 5, impresion: null }, paso: 1, segundos: "x" },
    { lectura: { psad: 0.1, lesiones: [null], categoria: null, decision: null, impresion: "" }, paso: 1, segundos: 0 }]) {
    assert.equal(sanearBorrador(malo), null, JSON.stringify(malo));
  }
  const b = sanearBorrador({ lectura, paso: 99, segundos: -3 });
  assert.deepEqual(b, { lectura, paso: 0, segundos: 0 });
  localStorage.setItem("prostata-lab:borrador:v1:" + c.id, "123");
  assert.equal(almacen.borrador(c.id), null);
});

test("M3: el CSV del panel no deja fórmulas ejecutables", () => {
  let g = grupoVacio();
  for (const s of ['=HYPERLINK("http://x";"clic")', "+1", "-A1", "@SUMA(1)"]) g = anadirAlGrupo(g, { ...JSON.parse(exportacion("", [])), seudonimo: s }).grupo;
  const celdas = csvGrupo(g, [c.id]).split("\n").slice(1, -1).map((f) => f.replace(/^"/, "").split(";")[0]!);
  for (const celda of celdas) assert.match(celda, /^'/, celda);
  assert.equal(seudonimoValido("-A1"), false, "un seudónimo no empieza por «-»");
  assert.equal(seudonimoValido("R2-azul"), true);
});

test("M4: un archivo con nombre y apellidos o correo como seudónimo no entra en el panel", async () => {
  const r = leerExportacion(exportacion("Juan Pérez García juan@correo.es", [intento("a")]));
  assert.ok(r.ok && r.seudonimoDescartado && r.datos.seudonimo === "");
  const avisos = await cargarArchivosDocente([archivo("nombre.json", exportacion("Juan Pérez García juan@correo.es", [intento("a")]))], recorregirOk);
  assert.match(avisos[0]!, /seudónimo parece un nombre/);
  assert.ok(!avisos.join(" ").includes("Juan"), "no se repite el nombre en los mensajes");
  assert.deepEqual(Object.keys(almacen.grupo().alumnos), []);
  // «Recuperar una copia» tampoco adopta ese seudónimo.
  await recuperarCopia(archivo("nombre.json", exportacion("Juan Pérez García juan@correo.es", [intento("a")])), [c.id]);
  assert.equal(almacen.progreso().seudonimo, "");
});

test("B1: la tabla campo a campo de la corrección tiene columnas fijas y parte las palabras largas", () => {
  const css = readFileSync(new URL("../src/estilos.css", import.meta.url), "utf-8");
  assert.match(css, /\.campo-a-campo\s*\{[^}]*table-layout:\s*fixed/);
  assert.match(css, /\.campo-a-campo th, \.campo-a-campo td\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("B2: un «%» mal formado (o «#/constructor») en la ruta no rompe el router", () => {
  assert.doesNotThrow(() => leerRuta("#/caso/%"));
  assert.deepEqual(leerRuta("#/caso/%E0%A4%A"), { hash: "caso/%E0%A4%A", nombre: "caso", parametro: "%E0%A4%A" });
  assert.equal(leerRuta("#/caso/a%20b").parametro, "a b");
  // Hallado al comprobar B2: «#/constructor» dejaba la página en blanco («n.vista is not a function»).
  const rutas = { "": 1, casos: 2 };
  assert.equal(rutaPropia(rutas, "constructor"), undefined);
  assert.equal(rutaPropia(rutas, "toString"), undefined);
  assert.equal(rutaPropia(rutas, "casos"), 2);
});

test("B3: la API rechaza categorías no enteras y decisiones que no son del caso", () => {
  assert.equal(corregirPeticion({ caso: c.id, lectura: { ...lectura, categoria: 2.5 } }).estado, 422);
  assert.equal(corregirPeticion({ caso: c.id, lectura: { ...lectura, decision: "z" } }).estado, 422);
  const l = { ...lectura, lesiones: [{ id: "L1", sectores: ["mid_PZ_pl_D"], t2: 3.7, dwi: 4, tamano: null, epe: null, pirads: 3.7, marca: null }] };
  assert.equal(corregirPeticion({ caso: c.id, lectura: l }).estado, 422);
  const r = recorregirLote({ intentos: [{ caso: c.id, lectura: { ...lectura, decision: "z" } }] });
  assert.ok(r.json.ok && r.json.notas[0] === null);
  assert.equal(corregirPeticion({ caso: c.id, lectura }).estado, 200, "una lectura normal se sigue corrigiendo");
});

test("B4: un intento con valores imposibles no se acepta", () => {
  const bueno = intento("a");
  assert.ok(esIntento(bueno));
  for (const malo of [{ nota: 1e308 }, { nota: -50 }, { segundos: 1e15 }, { segundos: -5000 }, { fin: "0001-01-01T00:00:00Z" }, { fin: "2199-01-01T00:00:00Z" }, { componentes: { deteccion: 9e99 } }]) {
    assert.equal(esIntento({ ...bueno, ...malo }), false, JSON.stringify(malo));
  }
});

test("B4: al recuperar una copia, los intentos de casos que no existen se descartan", async () => {
  const r = await recuperarCopia(archivo("c.json", exportacion("R2", [intento("a"), { ...intento("b"), caso: "no-existe" }])), casos.map((x) => x.id));
  assert.ok(r.ok);
  assert.match(r.mensaje, /1 intentos nuevos\. 1 descartados/);
  assert.equal(almacen.progreso().intentos.length, 1);
});

test("B5: la corrección de un caso que no existe no se presenta como fallo de conexión", () => {
  const src = readFileSync(new URL("../src/vistas/correccion.ts", import.meta.url), "utf-8");
  assert.ok(!src.includes('throw new Error("caso")'), "el caso ausente no debe acabar en errorCarga()");
  assert.match(src, /caso que no está en Próstata Lab/);
});

test("B6: /api/* desconocido da 404 JSON y un método no admitido, 405 JSON", async () => {
  const n = noEncontrado();
  assert.equal(n.status, 404);
  assert.match(n.headers.get("content-type")!, /json/);
  const get = () => new Response("[]", { headers: { "content-type": "application/json" } });
  const r405 = await segunMetodo(new Request("https://x/api/corregir"), { POST: get });
  assert.equal(r405.status, 405);
  assert.equal(r405.headers.get("allow"), "POST");
  assert.equal((await r405.json()).ok, false);
  const head = await segunMetodo(new Request("https://x/api/casos", { method: "HEAD" }), { GET: get });
  assert.equal(head.status, 200);
  assert.match(head.headers.get("content-type")!, /json/);
  assert.equal((await segunMetodo(new Request("https://x/api/casos", { method: "DELETE" }), { GET: get })).headers.get("allow"), "GET, HEAD");
  const rutas = readFileSync(new URL("../functions/api/[[ruta]].ts", import.meta.url), "utf-8");
  assert.match(rutas, /noEncontrado/);
});

test("B7: con un seudónimo no válido en la caja no se exporta", () => {
  localStorage.setItem("prostata-lab:progreso:v1", JSON.stringify({ version: 1, seudonimo: "R2-azul", intentos: [intento("a")] }));
  const r = prepararExportacion("Nombre Apellido Apellido");
  assert.equal(r.ok, false);
  const bien = prepararExportacion("R3");
  assert.ok(bien.ok && JSON.parse(bien.contenido).seudonimo === "R3" && bien.nombre.startsWith("prostata-lab-R3-"));
});

test("B8: un clic lejos de la glándula se reconoce como tal", () => {
  const cuadrado = [[[100, 100], [200, 100], [200, 200], [100, 200]]];
  assert.equal(lejosDeLaGlandula(cuadrado, 5, 5, 0.2), true, "esquina de la imagen");
  assert.equal(lejosDeLaGlandula(cuadrado, 95, 150, 0.2), false, "1 mm del borde: cápsula o periprostático");
  assert.equal(lejosDeLaGlandula([], 5, 5, 0.2), false, "sin zonas en el corte, se mantiene el mensaje de siempre");
});

test("B9: importar dos veces el mismo archivo sin seudónimo no crea dos alumnos", () => {
  const e = JSON.parse(exportacion("", [intento("a"), intento("b")]));
  let g = anadirAlGrupo(grupoVacio(), e).grupo;
  g = anadirAlGrupo(g, e).grupo;
  assert.deepEqual(Object.keys(g.alumnos), ["Sin seudónimo 1"]);
  g = anadirAlGrupo(g, JSON.parse(exportacion("", [intento("z")]))).grupo;
  assert.equal(Object.keys(g.alumnos).length, 2, "otro archivo sin seudónimo sí es otro alumno");
});

test("B10 y B11: HSTS en todas las respuestas y las imágenes se revalidan", () => {
  const h = readFileSync(new URL("../public/_headers", import.meta.url), "utf-8");
  assert.match(h, /^\/\*\n(?:  .+\n)*  Strict-Transport-Security: max-age=31536000; includeSubDomains\n/m);
  assert.doesNotMatch(h, /preload/);
  const casosH = h.split("/casos/*")[1]!.split("\n\n")[0]!;
  assert.match(casosH, /Cache-Control: public, max-age=0, must-revalidate/);
});

test("B12: un archivo con demasiados intentos se rechaza", () => {
  const muchos = Array.from({ length: MAX_INTENTOS_ARCHIVO + 1 }, (_, k) => intento(`x${k}`));
  const r = leerExportacion(exportacion("R2", muchos));
  assert.equal(r.ok, false);
  assert.ok(!r.ok && /demasiados intentos/.test(r.mensaje));
  assert.ok(leerExportacion(exportacion("R2", muchos.slice(0, MAX_INTENTOS_ARCHIVO))).ok);
});
