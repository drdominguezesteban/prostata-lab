/**
 * Ajustes decididos por Mario (20 nov 2026): «caso perfecto» exige la densidad de PSA, B9 en los dos
 * órdenes de importación y HEAD /api/casos en el servidor de desarrollo. Solo datos sintéticos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import casosJson from "../datos/casos.json";
import { corregir } from "../shared/puntuacion";
import { recorregirLote } from "../shared/servidor";
import { anadirAlGrupo, aplicarNotas, exportar, grupoVacio, intentoDesde, progresoVacio, resumir, type Intento } from "../shared/progreso";
import type { Caso, LesionAlumno, Lectura } from "../shared/tipos";
import configuracion from "../vite.config";

const casos = casosJson as Caso[];
const caso = (id: string) => casos.find((c) => c.id === id)!;
const lesion = (id: string, sectores: string[], extra: Partial<LesionAlumno> = {}): LesionAlumno =>
  ({ id, sectores, t2: null, dwi: null, tamano: null, epe: "no", pirads: null, marca: null, ...extra });

function perfecta(c: Caso): Lectura {
  return {
    psad: c.densidad_psa_correcta,
    categoria: c.categoria_estudio,
    decision: c.decision.correcta[0]!,
    impresion: "",
    lesiones: c.lesiones.map((l) => lesion(l.id, l.sectores, { t2: l.t2, dwi: l.dwi, tamano: l.tamano, epe: l.epe, pirads: l.pirads_global })),
  };
}

// ── 1. Caso perfecto con la densidad de PSA ────────────────────────────────────

test("caso perfecto: un estudio sin lesión con 92 puntos y la densidad de PSA fuera de la tolerancia no es perfecto", () => {
  const c = caso("10326_1000332");
  assert.equal(c.lesiones.length, 0);
  const r = corregir(c, { ...perfecta(c), psad: c.densidad_psa_correcta + 0.05 });
  assert.equal(r.nota, 92);
  assert.ok(r.nota >= 90 && !r.critico);
  assert.equal(r.componentes.find((x) => x.clave === "psad")!.valor, 0);
  assert.equal(r.perfecto, false);
  assert.equal(corregir(c, { ...perfecta(c), psad: null }).perfecto, false, "sin responder la densidad, tampoco");
});

test("caso perfecto: el mismo estudio con la densidad de PSA correcta (o dentro de la tolerancia) sí lo es", () => {
  const c = caso("10326_1000332");
  const r = corregir(c, perfecta(c));
  assert.equal(r.componentes.find((x) => x.clave === "psad")!.valor, 1);
  assert.equal(r.perfecto, true);
  assert.equal(corregir(c, { ...perfecta(c), psad: c.densidad_psa_correcta + 0.01 }).perfecto, true, "redondeo tolerado");
  // Con nota ≥ 90 pero un fallo en otro componente sigue pudiendo ser perfecto: solo se añade la densidad.
  const d = caso("10807_1000823");
  assert.equal(corregir(d, { ...perfecta(d), decision: d.decision.aceptable[0]! }).perfecto, true);
  assert.equal(corregir(d, { ...perfecta(d), psad: null }).perfecto, false, "con lesión, 95 puntos sin densidad ya no es perfecto");
});

/**
 * Notas calculadas con el código de `main` en 1a264ec (antes de este cambio): [nota, nota sin penalización, crítico].
 * Si alguna cambia, el ajuste habría tocado la nota y no solo la etiqueta.
 */
const NOTAS_MAIN: Record<string, Record<string, [number, number, boolean]>> = {
  "10326_1000332": { perfecta: [100, 100, false], sinPsad: [92, 92, false], psadMal: [92, 92, false], categoriaMenos1: [83, 83, false], decisionAceptable: [83, 83, false], decisionCritica: [73, 83, true], sinLesiones: [100, 100, false], medioSector: [100, 100, false], falsoPositivo: [79, 79, false], vacia: [42, 42, false] },
  "10599_1000613": { perfecta: [100, 100, false], sinPsad: [92, 92, false], psadMal: [92, 92, false], categoriaMenos1: [83, 83, false], decisionAceptable: [83, 83, false], decisionCritica: [73, 83, true], sinLesiones: [100, 100, false], medioSector: [100, 100, false], falsoPositivo: [79, 79, false], vacia: [42, 42, false] },
  "10807_1000823": { perfecta: [100, 100, false], sinPsad: [95, 95, false], psadMal: [95, 95, false], categoriaMenos1: [90, 90, false], decisionAceptable: [95, 95, false], decisionCritica: [80, 90, true], sinLesiones: [35, 35, false], medioSector: [90, 90, false], falsoPositivo: [94, 94, false], vacia: [0, 0, false] },
  "11377_1001400": { perfecta: [100, 100, false], sinPsad: [95, 95, false], psadMal: [95, 95, false], categoriaMenos1: [90, 90, false], decisionAceptable: [95, 95, false], decisionCritica: [80, 90, true], sinLesiones: [35, 35, false], medioSector: [93, 93, false], falsoPositivo: [94, 94, false], vacia: [0, 0, false] },
  "11137_1001160": { perfecta: [100, 100, false], sinPsad: [95, 95, false], psadMal: [95, 95, false], categoriaMenos1: [90, 90, false], decisionAceptable: [95, 95, false], decisionCritica: [80, 90, true], sinLesiones: [35, 35, false], medioSector: [100, 100, false], falsoPositivo: [94, 94, false], vacia: [0, 0, false] },
  "11032_1001052": { perfecta: [100, 100, false], sinPsad: [95, 95, false], psadMal: [95, 95, false], categoriaMenos1: [90, 90, false], decisionAceptable: [95, 95, false], decisionCritica: [80, 90, true], sinLesiones: [35, 35, false], medioSector: [93, 93, false], falsoPositivo: [94, 94, false], vacia: [0, 0, false] },
  "11260_1001283": { perfecta: [100, 100, false], sinPsad: [95, 95, false], psadMal: [95, 95, false], categoriaMenos1: [90, 90, false], decisionAceptable: [95, 95, false], decisionCritica: [80, 90, true], sinLesiones: [35, 35, false], medioSector: [92, 92, false], falsoPositivo: [97, 97, false], vacia: [0, 0, false] },
};

const VARIANTES: Record<string, (c: Caso) => Lectura> = {
  perfecta,
  sinPsad: (c) => ({ ...perfecta(c), psad: null }),
  psadMal: (c) => ({ ...perfecta(c), psad: c.densidad_psa_correcta + 0.1 }),
  categoriaMenos1: (c) => ({ ...perfecta(c), categoria: c.categoria_estudio - 1 }),
  decisionAceptable: (c) => ({ ...perfecta(c), decision: c.decision.aceptable[0] ?? "d" }),
  decisionCritica: (c) => ({ ...perfecta(c), decision: c.decision.critico_si_elige[0]! }),
  sinLesiones: (c) => ({ ...perfecta(c), lesiones: [] }),
  medioSector: (c) => ({ ...perfecta(c), lesiones: perfecta(c).lesiones.map((l) => ({ ...l, sectores: l.sectores.slice(0, 1) })) }),
  falsoPositivo: (c) => ({
    ...perfecta(c),
    lesiones: [...perfecta(c).lesiones, lesion("X", (c.id === casos[6]!.id ? casos[5]! : casos[6]!).lesiones[0]!.sectores.filter((s) => !c.lesiones.some((l) => l.sectores.includes(s))), { pirads: 4 })],
  }),
  vacia: () => ({ psad: null, categoria: null, decision: null, impresion: "", lesiones: [] }),
};

test("las notas de los 7 casos no cambian respecto a main (solo cambia la etiqueta)", () => {
  assert.equal(casos.length, 7);
  assert.deepEqual(Object.keys(NOTAS_MAIN).sort(), casos.map((c) => c.id).sort());
  for (const c of casos) {
    for (const [v, f] of Object.entries(VARIANTES)) {
      const r = corregir(c, f(c));
      assert.deepEqual([r.nota, r.notaSinPenalizacion, r.critico], NOTAS_MAIN[c.id]![v], `caso ${c.numero}, ${v}`);
    }
  }
});

test("intentos ya guardados: «Mis resultados» conserva la etiqueta antigua y el panel docente la recalcula sin tomarla por un archivo editado", () => {
  const c = caso("10326_1000332");
  const lectura = { ...perfecta(c), psad: c.densidad_psa_correcta + 0.05 };
  const nuevo = corregir(c, lectura);
  // Un intento guardado antes del cambio: misma nota, pero con la etiqueta antigua.
  const antiguo: Intento = { ...intentoDesde(c.id, lectura, nuevo, 60), perfecto: true };
  assert.equal(resumir([antiguo]).perfectos, 1, "«Mis resultados» cuenta lo guardado en el navegador");
  const lote = recorregirLote({ intentos: [{ caso: c.id, lectura }] });
  assert.ok(lote.json.ok);
  const v = aplicarNotas([antiguo], lote.json.notas);
  assert.equal(v.intentos[0]!.perfecto, false, "el panel docente usa la etiqueta recalculada");
  assert.equal(v.intentos[0]!.nota, antiguo.nota);
  assert.equal(v.cambiadas, 0, "no se avisa de «nota recalculada distinta» solo porque cambie la etiqueta");
});

// ── 3. B9 en los dos órdenes ───────────────────────────────────────────────────

const c1 = caso("10807_1000823");
const intento = (id: string): Intento => ({ ...intentoDesde(c1.id, perfecta(c1), corregir(c1, perfecta(c1)), 60), id });
const archivo = (seudonimo: string, intentos: Intento[]) => JSON.parse(exportar({ ...progresoVacio(), seudonimo, intentos }));

test("B9: primero el archivo con seudónimo y después el mismo sin él: un solo alumno", () => {
  let g = anadirAlGrupo(grupoVacio(), archivo("R2-azul", [intento("a"), intento("b")])).grupo;
  const r = anadirAlGrupo(g, archivo("", [intento("a"), intento("b"), intento("c")]));
  g = r.grupo;
  assert.equal(r.seudonimo, "R2-azul");
  assert.deepEqual(Object.keys(g.alumnos), ["R2-azul"]);
  assert.deepEqual(g.alumnos["R2-azul"]!.intentos.map((i) => i.id).sort(), ["a", "b", "c"]);
});

test("B9: primero el archivo sin seudónimo y después el que lo tiene: un solo alumno", () => {
  let g = anadirAlGrupo(grupoVacio(), archivo("", [intento("a"), intento("b"), intento("c")])).grupo;
  g = anadirAlGrupo(g, archivo("", [intento("z")])).grupo;
  assert.deepEqual(Object.keys(g.alumnos).sort(), ["Sin seudónimo 1", "Sin seudónimo 2"]);
  const r = anadirAlGrupo(g, archivo("R2-azul", [intento("a"), intento("b")]));
  g = r.grupo;
  assert.equal(r.seudonimo, "R2-azul");
  assert.deepEqual(Object.keys(g.alumnos).sort(), ["R2-azul", "Sin seudónimo 2"], "el otro alumno sin seudónimo no se toca");
  assert.deepEqual(g.alumnos["R2-azul"]!.intentos.map((i) => i.id).sort(), ["a", "b", "c"], "no se pierde ningún intento");
  assert.deepEqual(g.alumnos["Sin seudónimo 2"]!.intentos.map((i) => i.id), ["z"]);
  // Volver a importar cualquiera de los dos ya no crea a nadie.
  g = anadirAlGrupo(g, archivo("", [intento("a")])).grupo;
  g = anadirAlGrupo(g, archivo("R2-azul", [intento("b")])).grupo;
  assert.deepEqual(Object.keys(g.alumnos).sort(), ["R2-azul", "Sin seudónimo 2"]);
});

test("B9: un alumno con seudónimo no absorbe a otro alumno con seudónimo aunque compartan intentos", () => {
  let g = anadirAlGrupo(grupoVacio(), archivo("R1", [intento("a")])).grupo;
  g = anadirAlGrupo(g, archivo("R2", [intento("a")])).grupo;
  assert.deepEqual(Object.keys(g.alumnos).sort(), ["R1", "R2"]);
});

// ── 4. HEAD /api/casos en el servidor de desarrollo ────────────────────────────

async function pedir(metodo: string, url: string): Promise<{ estado: number; cabeceras: Record<string, string>; cuerpo: string | undefined; siguiente: boolean }> {
  let manejador: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | undefined;
  const plugin = (configuracion as { plugins: Array<{ configureServer: (s: unknown) => void }> }).plugins[0]!;
  plugin.configureServer({ middlewares: { use: (f: typeof manejador) => (manejador = f) } });
  return new Promise((resolver) => {
    const cabeceras: Record<string, string> = {};
    const res = {
      statusCode: 200,
      setHeader: (k: string, v: string) => (cabeceras[k.toLowerCase()] = v),
      removeHeader: (k: string) => delete cabeceras[k.toLowerCase()],
      end(cuerpo?: string) { resolver({ estado: this.statusCode, cabeceras, cuerpo, siguiente: false }); },
    };
    manejador!({ method: metodo, url } as IncomingMessage, res as unknown as ServerResponse, () => resolver({ estado: 0, cabeceras, cuerpo: undefined, siguiente: true }));
  });
}

test("servidor de desarrollo: HEAD /api/casos da 200 sin cuerpo, y GET sigue dando el catálogo", async () => {
  const head = await pedir("HEAD", "/api/casos");
  assert.equal(head.estado, 200);
  assert.equal(head.cuerpo, undefined);
  assert.match(head.cabeceras["content-type"]!, /application\/json/);
  const get = await pedir("GET", "/api/casos?x=1");
  assert.equal(get.estado, 200);
  assert.equal(JSON.parse(get.cuerpo!).length, 7);
  assert.equal((await pedir("DELETE", "/api/casos")).estado, 405);
  assert.equal((await pedir("HEAD", "/api/no-existe")).estado, 404);
});
