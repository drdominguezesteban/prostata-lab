/** Borrador del informe del alumno: las lesiones sin sector también aparecen. Solo datos sintéticos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { informeAlumno } from "../src/informe";
import type { CasoPublico } from "../shared/servidor";
import type { LesionAlumno, Lectura } from "../shared/tipos";

const caso = {
  id: "sintetico", numero: 99, nivel: 1, edad: 60, psa: 5, volumen: 50,
  contexto_docente: { tacto_rectal: "normal", antecedentes_familiares: "no", inhibidor_5ari: false, biopsias_previas: "ninguna" },
  aviso_contexto: "", opciones: [{ id: "a", texto: "Opción sintética" }],
  tecnica: { n_cortes: 10, mm_por_px: 0.5, grosor_corte_mm: 3, b_alto: 1400, equipo: "Equipo sintético" }, zonal: false,
} satisfies CasoPublico;

const lesion = (id: string, extra: Partial<LesionAlumno> = {}): LesionAlumno =>
  ({ id, sectores: ["mid_PZ_pl_D"], t2: 4, dwi: 4, tamano: "<1.5", epe: "no", pirads: 4, marca: null, ...extra });
const lectura = (lesiones: LesionAlumno[]): Lectura => ({ psad: 0.1, lesiones, categoria: null, decision: null, impresion: "" });

test("informe: sin lesiones añadidas dice «Sin lesiones focales sospechosas.»", () => {
  assert.match(informeAlumno(caso, lectura([])), /^Sin lesiones focales sospechosas\.$/m);
});

test("informe: una L1 sin sector no da «Sin lesiones…» y aparece con «—» donde falta el sector", () => {
  const t = informeAlumno(caso, lectura([lesion("L1", { sectores: [] })]));
  assert.doesNotMatch(t, /Sin lesiones focales sospechosas/);
  assert.match(t, /^Lesión 1: —; —\. Tamaño <1,5 cm\.$/m);
  assert.match(t, /^- Categoría PI-RADS v2\.1: 4\.$/m);
  assert.match(t, /^Conclusión: estudio PI-RADS —\.$/m);
});

test("informe: la lesión sin sector se numera junto a las demás y no cambia la línea de las que tienen sector", () => {
  const con = informeAlumno(caso, lectura([lesion("L1")]));
  const ambas = informeAlumno(caso, lectura([lesion("L1", { pirads: 5 }), lesion("L2", { sectores: [], pirads: null })]));
  const linea1 = con.split("\n").find((x) => x.startsWith("Lesión 1"))!;
  assert.ok(ambas.includes(linea1.replace("Lesión 1:", "Lesión 1 (índice):")), ambas);
  assert.match(ambas, /^Lesión 2: —; —\. Tamaño <1,5 cm\.$/m);
});
