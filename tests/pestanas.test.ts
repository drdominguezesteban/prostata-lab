/** Pestañas de secuencia del visor en el móvil (PR B). La interacción real se probó con Playwright en local. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANCHO_MOVIL, CONSULTA_MOVIL, pestanaSegunTecla } from "../src/pestanas";

test("pestañas: flechas con vuelta, Inicio y Fin (patrón WAI-ARIA Tabs)", () => {
  assert.equal(pestanaSegunTecla(0, "ArrowRight", 3), 1);
  assert.equal(pestanaSegunTecla(2, "ArrowRight", 3), 0, "de la última vuelve a la primera");
  assert.equal(pestanaSegunTecla(0, "ArrowLeft", 3), 2, "de la primera va a la última");
  assert.equal(pestanaSegunTecla(1, "ArrowLeft", 3), 0);
  assert.equal(pestanaSegunTecla(1, "Home", 3), 0);
  assert.equal(pestanaSegunTecla(0, "End", 3), 2);
});

test("pestañas: las demás teclas no son suyas (las flechas arriba/abajo siguen siendo del visor)", () => {
  for (const k of ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Enter", " ", "Tab", "a"]) assert.equal(pestanaSegunTecla(1, k, 3), null, k);
  assert.equal(pestanaSegunTecla(0, "ArrowRight", 0), null);
});

test("pestañas: solo por debajo de 600 px; 768 px (tableta vertical) se ve como escritorio", () => {
  assert.equal(ANCHO_MOVIL, 599);
  assert.equal(CONSULTA_MOVIL, "(max-width: 599.98px)");
});

test("pestañas: el CSS de una sola columna solo se aplica con .visor-movil", () => {
  const css = readFileSync(new URL("../src/estilos.css", import.meta.url), "utf-8");
  assert.match(css, /\.visor-3\.visor-movil \.visor-paneles \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.visor-panel\[hidden\] \{ display: none; \}/);
});
