import { test } from "node:test";
import assert from "node:assert/strict";
import casosJson from "../datos/casos.json";
import { corregir, emparejar, piradsPorRegla, PENALIZACION_ERROR_CRITICO, calcularPsad } from "../shared/puntuacion";
import type { Caso, LesionAlumno, Lectura } from "../shared/tipos";

const casos = casosJson as Caso[];
const caso = (id: string) => casos.find((c) => c.id === id)!;

function lesion(id: string, sectores: string[], extra: Partial<LesionAlumno> = {}): LesionAlumno {
  return { id, sectores, t2: null, dwi: null, tamano: null, epe: "no", pirads: null, marca: null, ...extra };
}

/** La lectura del autor: debe sacar 100. */
function lecturaPerfecta(c: Caso): Lectura {
  return {
    psad: c.densidad_psa_correcta,
    categoria: c.categoria_estudio,
    decision: c.decision.correcta[0]!,
    impresion: "",
    lesiones: c.lesiones.map((l) => lesion(l.id, l.sectores, { t2: l.t2, dwi: l.dwi, tamano: l.tamano, epe: l.epe, pirads: l.pirads_global })),
  };
}

for (const c of casos) {
  test(`caso ${c.numero}: la lectura del autor saca 100 y es caso perfecto`, () => {
    const r = corregir(c, lecturaPerfecta(c));
    assert.equal(r.nota, 100);
    assert.ok(r.perfecto);
    assert.equal(r.comentarios.length, 0, r.comentarios.join(" | "));
    assert.equal(r.erroresRegla.length, 0);
  });
}

test("regla v2.1 sin DCE", () => {
  assert.equal(piradsPorRegla("PZ", 2, 4), 4, "en la ZP manda la DWI");
  assert.equal(piradsPorRegla("TZ", 3, 5), 4, "ZT: T2 3 + DWI 5 = 4");
  assert.equal(piradsPorRegla("TZ", 3, 4), 3);
  assert.equal(piradsPorRegla("TZ", 2, 4), 3);
  assert.equal(piradsPorRegla("TZ", 5, 3), 5);
  assert.equal(piradsPorRegla("AS", 4, 4), null);
});

test("error crítico: penaliza la decisión y resta 10, sin anular el resto (caso 11137, «No biopsia» en PI-RADS 4)", () => {
  const c = caso("11137_1001160");
  const l = lecturaPerfecta(c);
  const r = corregir(c, { ...l, decision: "a" });
  assert.ok(r.critico);
  assert.equal(r.decision, "critica");
  const comp = Object.fromEntries(r.componentes.map((x) => [x.clave, x.valor]));
  assert.equal(comp.decision, 0);
  assert.equal(comp.pirads, 1, "la categoría sigue puntuando");
  assert.equal(comp.psad, 1);
  assert.equal(r.notaSinPenalizacion, 90);
  assert.equal(r.nota, 90 - PENALIZACION_ERROR_CRITICO);
  assert.ok(!r.perfecto);
  assert.ok(r.comentarios.some((t) => t.length > 0), "comentario del autor para decision=a");
});

test("la categoría del estudio se puntúa aunque la lesión no se empareje", () => {
  const c = caso("11137_1001160");
  const r = corregir(c, { ...lecturaPerfecta(c), lesiones: [lesion("L1", ["base_TZ_a_I"], { pirads: 4 })] });
  const comp = Object.fromEntries(r.componentes.map((x) => [x.clave, x.valor]));
  assert.equal(comp.pirads, 1);
  assert.equal(comp.deteccion, 0, "1 omitida y 1 falso positivo");
});

test("sector contiguo: empareja con crédito parcial, no cuenta como falso positivo + omisión", () => {
  const c = caso("11137_1001160"); // referencia: apex_PZ_pl_D
  const parejas = emparejar([lesion("L1", ["mid_PZ_pl_D"], { pirads: 4 })], c.lesiones);
  assert.equal(parejas.length, 1);
  assert.equal(parejas[0]!.tipo, "adyacente");
  const r = corregir(c, { ...lecturaPerfecta(c), lesiones: [lesion("L1", ["mid_PZ_pl_D"], { t2: 3, dwi: 4, tamano: "<1.5", pirads: 4 })] });
  const comp = Object.fromEntries(r.componentes.map((x) => [x.clave, x.valor]));
  assert.equal(comp.deteccion, 1);
  assert.equal(comp.localizacion, 0.4);
});

test("dos lesiones: se empareja cada una con la suya aunque el orden cambie", () => {
  const c = caso("11260_1001283");
  const [l1, l2] = c.lesiones;
  const p = emparejar([lesion("L1", l2!.sectores), lesion("L2", l1!.sectores)], c.lesiones);
  assert.deepEqual(p.map((x) => [x.alumno?.id, x.referencia?.id, x.tipo]), [["L2", "L1", "coincide"], ["L1", "L2", "coincide"]]);
});

test("satisfacción de búsqueda: solo una de dos lesiones → comentario «lesiones=1»", () => {
  const c = caso("11260_1001283");
  const l = lecturaPerfecta(c);
  const r = corregir(c, { ...l, lesiones: [l.lesiones[0]!] });
  assert.ok(r.comentarios.some((t) => /segundo foco/.test(t)));
  assert.equal(r.componentes.find((x) => x.clave === "deteccion")!.valor, 0.5);
});

test("estudio negativo: localización y secuencias no aplican; un falso positivo resta", () => {
  const c = caso("10326_1000332");
  const r0 = corregir(c, lecturaPerfecta(c));
  assert.equal(r0.componentes.find((x) => x.clave === "localizacion")!.valor, null);
  assert.equal(r0.nota, 100);
  const r1 = corregir(c, { ...lecturaPerfecta(c), lesiones: [lesion("L1", ["mid_TZ_a_D"], { pirads: 3 })], categoria: 3 });
  assert.equal(r1.componentes.find((x) => x.clave === "deteccion")!.valor, 0.5);
  assert.ok(r1.nota < 100);
  assert.ok(r1.comentarios.some((t) => /PI-RADS 3/.test(t)));
});

test("una lesión PI-RADS ≤2 anotada no cuenta como falso positivo", () => {
  const c = caso("10599_1000613");
  const r = corregir(c, { ...lecturaPerfecta(c), lesiones: [lesion("L1", ["mid_PZ_pl_D"], { pirads: 2 })] });
  assert.equal(r.nota, 100);
});

test("error de regla: PI-RADS que no sigue sus propias puntuaciones", () => {
  const c = caso("11377_1001400");
  const l = lecturaPerfecta(c);
  const r = corregir(c, { ...l, lesiones: [{ ...l.lesiones[0]!, pirads: 4 }] });
  assert.deepEqual(r.erroresRegla, [{ lesion: "L1", esperado: 3, puesto: 4 }]);
});

test("densidad de PSA: tolera el redondeo, no un error real", () => {
  const c = caso("10807_1000823"); // 8,8 / 53 = 0,166 → 0,17
  assert.equal(calcularPsad(8.8, 53), 0.17);
  const psad = (v: number) => corregir(c, { ...lecturaPerfecta(c), psad: v }).componentes.find((x) => x.clave === "psad")!.valor;
  assert.equal(psad(0.166), 1);
  assert.equal(psad(0.16), 1);
  assert.equal(psad(0.2), 0);
});

test("decisión aceptable vale la mitad", () => {
  const c = caso("10807_1000823");
  const r = corregir(c, { ...lecturaPerfecta(c), decision: "b" });
  assert.equal(r.decision, "aceptable");
  assert.equal(r.nota, 95);
});

test("lectura vacía: nota baja, sin errores", () => {
  const c = caso("10807_1000823");
  const r = corregir(c, { psad: null, lesiones: [], categoria: null, decision: null, impresion: "" });
  assert.equal(r.nota, 0);
  assert.equal(r.decision, "sin_responder");
});
