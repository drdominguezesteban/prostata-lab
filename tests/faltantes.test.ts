/**
 * Envío claro: el resumen «Para corregir falta: …» del navegador y el servidor usan los mismos criterios
 * (`shared/faltantes.ts`). Solo lecturas sintéticas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import casosJson from "../datos/casos.json";
import { faltantesLectura, nombreFalta, type Falta } from "../shared/faltantes";
import { corregirPeticion, faltaEnLectura } from "../shared/servidor";
import type { Caso, LesionAlumno, Lectura } from "../shared/tipos";

const casos = casosJson as Caso[];
const caso = casos.find((c) => c.lesiones.length > 0)!;

const lesion = (id: string, extra: Partial<LesionAlumno> = {}): LesionAlumno =>
  ({ id, sectores: ["mid_PZ_pl_D"], t2: 4, dwi: 4, tamano: "<1.5", epe: "no", pirads: 4, marca: null, ...extra });

const completa = (): Lectura => ({ psad: 0.15, lesiones: [lesion("L1")], categoria: 4, decision: caso.decision.opciones[0]!.id, impresion: "" });

/** El criterio que tenía `faltaEnLectura` antes de este PR, copiado tal cual como referencia. */
function faltaEnLecturaAnterior(l: Lectura, c?: Caso): string | null {
  if (l.psad === null || l.psad <= 0 || l.psad > 5) return "Falta la densidad de PSA.";
  for (const x of l.lesiones) {
    if (!x.sectores.length || x.pirads === null) return `Falta el sector o la categoría de ${x.id}.`;
  }
  if (l.categoria === null) return "Falta la categoría PI-RADS del estudio.";
  if (l.decision === null) return "Falta la decisión clínica.";
  if (c && !c.decision.opciones.some((o) => o.id === l.decision)) return "Esa decisión no es una de las opciones del caso.";
  return null;
}

const LECTURAS: Array<[string, Lectura, Falta[]]> = [
  ["completa", completa(), []],
  ["sin PSA", { ...completa(), psad: null }, [{ campo: "psad", paso: 0, lesion: null }]],
  ["PSA fuera de rango", { ...completa(), psad: 6 }, [{ campo: "psad", paso: 0, lesion: null }]],
  ["PSA cero", { ...completa(), psad: 0 }, [{ campo: "psad", paso: 0, lesion: null }]],
  ["sin sector", { ...completa(), lesiones: [lesion("L1", { sectores: [] })] }, [{ campo: "sectores", paso: 1, lesion: "L1" }]],
  ["sin categoría de lesión", { ...completa(), lesiones: [lesion("L1", { pirads: null })] }, [{ campo: "pirads", paso: 1, lesion: "L1" }]],
  ["sin categoría del estudio", { ...completa(), categoria: null }, [{ campo: "categoria", paso: 2, lesion: null }]],
  ["sin decisión", { ...completa(), decision: null }, [{ campo: "decision", paso: 2, lesion: null }]],
  ["decisión que no es del caso", { ...completa(), decision: "z" }, [{ campo: "opcion", paso: 2, lesion: null }]],
  ["sin lesiones", { ...completa(), lesiones: [], categoria: 2 }, []],
  ["los dos borradores de Mario a la vez", { ...completa(), categoria: null, lesiones: [lesion("L1", { sectores: [] })] },
    [{ campo: "sectores", paso: 1, lesion: "L1" }, { campo: "categoria", paso: 2, lesion: null }]],
  ["todo vacío con dos lesiones", { psad: null, lesiones: [lesion("L1", { sectores: [], pirads: null }), lesion("L2", { pirads: null })], categoria: null, decision: null, impresion: "" },
    [{ campo: "psad", paso: 0, lesion: null }, { campo: "sectores", paso: 1, lesion: "L1" }, { campo: "pirads", paso: 1, lesion: "L1" },
      { campo: "pirads", paso: 1, lesion: "L2" }, { campo: "categoria", paso: 2, lesion: null }, { campo: "decision", paso: 2, lesion: null }]],
];

for (const [nombre, l, esperado] of LECTURAS) {
  test(`faltantes: ${nombre}`, () => {
    const f = faltantesLectura(l, caso.decision.opciones);
    assert.deepEqual(f, esperado);
    // El servidor da el mismo mensaje que antes, y falla si y solo si la función compartida encuentra algo.
    assert.equal(faltaEnLectura(l, caso), faltaEnLecturaAnterior(l, caso));
    assert.equal(faltaEnLectura(l, caso) === null, f.length === 0);
    // Y lo mismo por la petición completa: 422 con ese mensaje, o 200.
    const r = corregirPeticion({ caso: caso.id, lectura: l });
    if (f.length) assert.deepEqual([r.estado, r.json], [422, { ok: false, mensaje: faltaEnLecturaAnterior(l, caso) }]);
    else assert.equal(r.estado, 200);
  });
}

test("faltantes: sin opciones (navegador sin catálogo) no se juzga la decisión, solo si falta", () => {
  assert.deepEqual(faltantesLectura({ ...completa(), decision: "z" }), []);
  assert.deepEqual(faltantesLectura({ ...completa(), decision: null }), [{ campo: "decision", paso: 2, lesion: null }]);
});

test("faltantes: los nombres del resumen dicen el paso real del formulario", () => {
  assert.equal(nombreFalta({ campo: "categoria", paso: 2, lesion: null }), "la categoría PI-RADS del estudio (paso 3)");
  assert.equal(nombreFalta({ campo: "sectores", paso: 1, lesion: "L1" }), "el sector de L1 (paso 2)");
  assert.equal(nombreFalta({ campo: "psad", paso: 0, lesion: null }), "la densidad de PSA (paso 1)");
});

test("shared/faltantes.ts no importa valores de datos/ ni de shared/servidor (solo tipos)", () => {
  const fuente = readFileSync(new URL("../shared/faltantes.ts", import.meta.url), "utf8");
  for (const linea of fuente.split("\n").filter((x) => /^import\s/.test(x))) {
    assert.ok(/^import type\s/.test(linea), linea);
    assert.doesNotMatch(linea, /datos\/|servidor/);
  }
});
