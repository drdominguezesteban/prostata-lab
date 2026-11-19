// Reglas fijas de la web: sin «PhD», sin vínculo institucional, sin urgencias ni 112. cumplimiento: permitido
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..");
const EXT = /\.(ts|html|css|json|txt|svg|md)$/;

function archivos(dir: string): string[] {
  const r: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n !== "casos") r.push(...archivos(p));
    } else if (EXT.test(n) || n === "_headers") r.push(p);
  }
  return r;
}

const TODOS = [...archivos(join(RAIZ, "src")), ...archivos(join(RAIZ, "shared")), ...archivos(join(RAIZ, "public")), join(RAIZ, "index.html")];
const PROHIBIDO = [/\bPhD\b/i, /HUMV/i, /Valdecilla/i, /IDIVAL/i, /\burgencias\b/i, /\b112\b/, /pide cita/i];

test("la web no dice PhD, no se vincula con ninguna institución ni remite a urgencias", () => {
  assert.ok(TODOS.length > 20);
  for (const f of TODOS) {
    const t = readFileSync(f, "utf8");
    for (const re of PROHIBIDO) assert.doesNotMatch(t, re, `${f}: ${re}`);
  }
});

test("los datos de casos públicos no contienen la clave de respuestas", () => {
  for (const id of readdirSync(join(RAIZ, "public", "casos"))) {
    for (const n of readdirSync(join(RAIZ, "public", "casos", id))) assert.ok(n !== "geometria.json" && n !== "casos.json", `${id}/${n}`);
  }
});

test("la web avisa de que no es apoyo a decisiones clínicas", () => {
  assert.match(readFileSync(join(RAIZ, "src", "main.ts"), "utf8"), /No es un sistema de apoyo a decisiones clínicas/);
});
