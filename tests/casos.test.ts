import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import casosJson from "../datos/casos.json";
import geometriaJson from "../datos/geometria.json";
import { CONDICIONES_CONOCIDAS, piradsPorRegla } from "../shared/puntuacion";
import { esSector, zonaPrincipal } from "../shared/sectores";
import type { Caso } from "../shared/tipos";

const casos = casosJson as Caso[];
const geometria = geometriaJson as Record<string, { lesiones: Array<{ id: string; contornos_px: Record<string, unknown> }> }>;

test("hay 7 casos con número correlativo e id único", () => {
  assert.equal(casos.length, 7);
  assert.deepEqual(casos.map((c) => c.numero), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(new Set(casos.map((c) => c.id)).size, 7);
});

for (const c of casos) {
  test(`caso ${c.numero} (${c.id}): esquema y coherencia`, () => {
    assert.ok(c.categoria_estudio >= 1 && c.categoria_estudio <= 5);
    assert.ok(c.contexto_real.psa_ng_ml > 0 && c.contexto_real.volumen_ml > 0);
    const psad = Math.round((c.contexto_real.psa_ng_ml / c.contexto_real.volumen_ml) * 100) / 100;
    assert.ok(Math.abs(psad - c.densidad_psa_correcta) <= 0.01, `PSA-D ${psad} frente a ${c.densidad_psa_correcta}`);
    const ids = c.decision.opciones.map((o) => o.id);
    for (const id of [...c.decision.correcta, ...c.decision.aceptable, ...c.decision.critico_si_elige]) assert.ok(ids.includes(id), id);
    assert.ok(c.decision.correcta.length >= 1);
    for (const l of c.lesiones) {
      assert.ok(l.sectores.length > 0 && l.sectores.every(esSector), `sectores de ${l.id}`);
      assert.equal(zonaPrincipal(l.sectores), l.zona, `zona de ${l.id}`);
      assert.equal(piradsPorRegla(l.zona, l.t2, l.dwi), l.pirads_global, `regla v2.1 en ${l.id}`);
    }
    const max = Math.max(0, ...c.lesiones.map((l) => l.pirads_global));
    assert.equal(c.lesiones.length ? max : c.categoria_estudio, c.categoria_estudio, "la categoría del estudio es la de la lesión índice");
    for (const e of c.errores_frecuentes) assert.ok(CONDICIONES_CONOCIDAS.includes(e.si.split("=")[0]!), e.si);
    assert.ok(!/permite omitir/.test(JSON.stringify(c)), "redacción EAU corregida");
  });

  test(`caso ${c.numero}: imágenes y geometría`, () => {
    for (const seq of ["t2w", "adc", "hbv"]) {
      const dir = `public/casos/${c.id}/${seq}`;
      const pngs = readdirSync(dir).filter((f) => f.endsWith(".png"));
      assert.equal(pngs.length, c.tecnica.n_cortes, dir);
    }
    const g = geometria[c.id];
    assert.ok(g, "geometría");
    assert.deepEqual(g.lesiones.map((l) => l.id).sort(), c.lesiones.map((l) => l.id).sort());
    assert.ok(!existsSync(`public/casos/${c.id}/geometria.json`), "la geometría de referencia no se publica");
  });
}

test("las respuestas no están en public/", () => {
  for (const c of casos) {
    for (const f of readdirSync(`public/casos/${c.id}`).filter((f) => f.endsWith(".json"))) {
      const t = readFileSync(`public/casos/${c.id}/${f}`, "utf-8");
      assert.ok(!/pirads|explicacion|informe/i.test(t), f);
    }
  }
});
