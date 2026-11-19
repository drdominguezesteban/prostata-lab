import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTORES, legibilizar, nombreSector, sonAdyacentes, ladoDe } from "../shared/sectores";

test("hay 38 sectores únicos (14 en la base, 12 en el tercio medio y 12 en el ápex)", () => {
  assert.equal(SECTORES.length, 38);
  assert.equal(new Set(SECTORES.map((s) => s.codigo)).size, 38);
  assert.equal(SECTORES.filter((s) => s.nivel === "base").length, 14);
  assert.equal(SECTORES.filter((s) => s.nivel === "mid").length, 12);
  assert.equal(SECTORES.filter((s) => s.nivel === "apex").length, 12);
});

test("cada nivel cubre los 360° de ambos anillos sin solapes", () => {
  for (const nivel of ["base", "mid", "apex"]) {
    for (const anillo of ["interno", "externo"]) {
      const total = SECTORES.filter((s) => s.nivel === nivel && s.anillo === anillo).reduce((t, s) => t + (s.hasta - s.desde), 0);
      assert.equal(total, 360, `${nivel} ${anillo}`);
    }
  }
});

test("contigüidad: mismo nivel, línea media y niveles consecutivos", () => {
  assert.ok(sonAdyacentes("mid_PZ_pl_D", "mid_PZ_pm_D"));
  assert.ok(sonAdyacentes("mid_PZ_pm_D", "mid_PZ_pm_I"), "cruza la línea media");
  assert.ok(sonAdyacentes("mid_PZ_pl_D", "apex_PZ_pl_D"), "nivel contiguo");
  assert.ok(sonAdyacentes("mid_PZ_pl_D", "base_PZ_pl_D"));
  assert.ok(sonAdyacentes("mid_TZ_p_D", "mid_PZ_pl_D"), "ZT posterior con la ZP que la rodea");
  assert.ok(sonAdyacentes("base_CZ_D", "mid_TZ_p_D"));
  assert.ok(!sonAdyacentes("base_PZ_pl_D", "apex_PZ_pl_D"), "salta un nivel");
  assert.ok(!sonAdyacentes("mid_PZ_pl_D", "mid_PZ_pl_I"), "lados opuestos lejos de la línea media");
  assert.ok(!sonAdyacentes("mid_PZ_pl_D", "mid_PZ_pl_D"));
});

test("la contigüidad es simétrica", () => {
  for (const a of SECTORES) for (const b of SECTORES) {
    assert.equal(sonAdyacentes(a.codigo, b.codigo), sonAdyacentes(b.codigo, a.codigo), `${a.codigo} ${b.codigo}`);
  }
});

test("nombres legibles, sin códigos", () => {
  assert.equal(nombreSector("mid_PZ_pl_D"), "Tercio medio · ZP posterolateral · lado derecho");
  const t = legibilizar("Lesión 1 (mid_PZ_pl_D, base_PZ_pl_D). Tamaño ≥1,5 cm.");
  assert.ok(!/mid_|base_/.test(t), t);
  assert.ok(t.includes("Base · ZP posterolateral · lado derecho"));
  assert.equal(ladoDe(["mid_PZ_pl_D", "mid_PZ_pm_I"]), "ambos");
});
