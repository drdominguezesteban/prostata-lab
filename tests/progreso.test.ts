import { test } from "node:test";
import assert from "node:assert/strict";
import casosJson from "../datos/casos.json";
import { corregir } from "../shared/puntuacion";
import { anadirAlGrupo, csvGrupo, exportar, fusionarIntentos, grupoVacio, intentoDesde, leerExportacion, mejoraEnRepetidos, progresoVacio, resumenPorCaso, resumir, seudonimoValido } from "../shared/progreso";
import { corregirPeticion, catalogo, limpiarLectura } from "../shared/servidor";
import type { Caso, Lectura } from "../shared/tipos";

const casos = casosJson as Caso[];
const c = casos.find((x) => x.id === "10807_1000823")!;
const vacia: Lectura = { psad: 0.17, lesiones: [], categoria: 5, decision: "c", impresion: "" };

test("exportar e importar conserva los intentos", () => {
  const p = progresoVacio();
  p.seudonimo = "R2-azul";
  p.intentos.push(intentoDesde(c.id, vacia, corregir(c, vacia), 300, new Date("2026-11-19T10:00:00Z")));
  const r = leerExportacion(exportar(p));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.datos.seudonimo, "R2-azul");
    assert.equal(r.datos.intentos.length, 1);
  }
  assert.equal(leerExportacion("{}").ok, false);
  assert.equal(leerExportacion("no es json").ok, false);
});

test("seudónimo: corto, sin correo ni nombre completo", () => {
  assert.ok(seudonimoValido("R2-azul"));
  assert.ok(!seudonimoValido("a"));
  assert.ok(!seudonimoValido("ana@correo.es"));
  assert.ok(!seudonimoValido("Ana María López García"));
});

test("resumen y mejora en casos repetidos", () => {
  const i1 = intentoDesde(c.id, vacia, corregir(c, vacia), 60, new Date("2026-11-19T10:00:00Z"));
  const i2 = intentoDesde(c.id, vacia, corregir(c, { ...vacia, decision: "a" }), 60, new Date("2026-11-18T10:00:00Z"));
  const todos = fusionarIntentos([i1], [i2, i1]);
  assert.equal(todos.length, 2);
  assert.equal(todos[0], i2, "orden cronológico");
  const r = resumir(todos);
  assert.equal(r.casos, 1);
  assert.equal(r.notaMedia, i1.nota, "cuenta el último intento");
  assert.equal(r.minutos, 2);
  assert.deepEqual(mejoraEnRepetidos(todos), { casos: 1, primero: i2.nota, ultimo: i1.nota });
});

test("panel docente: agrupa por seudónimo y exporta CSV", () => {
  const p = { ...progresoVacio(), seudonimo: "R1-sol" };
  p.intentos.push(intentoDesde(c.id, vacia, corregir(c, vacia), 60));
  const e = leerExportacion(exportar(p));
  assert.ok(e.ok);
  if (!e.ok) return;
  let g = anadirAlGrupo(grupoVacio(), e.datos).grupo;
  g = anadirAlGrupo(g, e.datos).grupo;
  assert.equal(g.alumnos["R1-sol"]!.intentos.length, 1, "importar dos veces no duplica");
  const filas = resumenPorCaso(g, casos.map((x) => x.id));
  assert.equal(filas.find((f) => f.caso === c.id)!.alumnos, 1);
  const csv = csvGrupo(g, [c.id]);
  assert.match(csv, /^seudonimo;/);
  assert.match(csv, /R1-sol;1;1;/);
});

test("el catálogo público no lleva respuestas", () => {
  const t = JSON.stringify(catalogo());
  for (const clave of ["pirads", "lesiones", "correcta", "explicacion", "informe", "desenlace", "psad", "categoria", "errores"]) {
    assert.ok(!t.includes(`"${clave}`), clave);
  }
  assert.ok(!/ambas lesiones/.test(t), "las opciones no revelan cuántas lesiones hay");
});

test("la corrección en el servidor limpia la entrada", () => {
  const l = limpiarLectura({ psad: "x", lesiones: [{ sectores: ["mid_PZ_pl_D", "inventado"], t2: 9, pirads: 4 }], decision: "zz" });
  assert.ok(l);
  assert.deepEqual(l!.lesiones[0]!.sectores, ["mid_PZ_pl_D"]);
  assert.equal(l!.lesiones[0]!.t2, null);
  assert.equal(l!.decision, null);
  assert.equal(corregirPeticion({ caso: "no-existe", lectura: {} }).estado, 404);
  const r = corregirPeticion({ caso: c.id, lectura: vacia });
  assert.equal(r.estado, 200);
  assert.ok(r.json.ok && r.json.referencia.informe.length > 0 && !/mid_PZ/.test(r.json.referencia.informe));
});
