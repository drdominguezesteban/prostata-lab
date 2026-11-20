// Tras `vite build`: falla si alguna respuesta de datos/ aparece en el código que llega al navegador.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const casos = JSON.parse(readFileSync("datos/casos.json", "utf-8"));
const claves = ["densidad_psa_correcta", "categoria_estudio", "informe_referencia", "critico_si_elige", "errores_frecuentes"];
const textos = casos.flatMap((c) => [c.informe_referencia, ...c.lesiones.map((l) => l.explicacion)])
  .filter((t) => typeof t === "string" && t.length > 40)
  .map((t) => t.slice(Math.floor(t.length / 2) - 20, Math.floor(t.length / 2) + 20));

const dir = "dist/assets";
const bundle = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f)).map((f) => readFileSync(join(dir, f), "utf-8")).join("\n")
  + readFileSync("dist/index.html", "utf-8");
const fugas = [...claves, ...textos].filter((t) => bundle.includes(t));
if (fugas.length) {
  console.error(`Fuga de respuestas en dist/: ${fugas.map((f) => JSON.stringify(f.slice(0, 30))).join(", ")}`);
  process.exit(1);
}
console.log(`sin fugas: ${claves.length} claves y ${textos.length} textos de referencia ausentes de dist/`);
