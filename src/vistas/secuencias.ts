import { h, vaciar } from "../dom";
import { piradsPorRegla } from "../../shared/puntuacion";

const T2_ZP = [
  "Hiperintensidad homogénea (normal).",
  "Hipointensidad lineal, en cuña o difusa leve, de márgenes habitualmente mal definidos.",
  "Hipointensidad heterogénea o no circunscrita, redondeada y moderada. Incluye lo que no encaja en 2, 4 o 5.",
  "Foco o masa circunscrito, homogéneo, moderadamente hipointenso, confinado a la próstata y <1,5 cm de eje mayor.",
  "Igual que 4, pero ≥1,5 cm o con extensión extraprostática o invasión definidas.",
];
const T2_ZT = [
  "ZT normal (raro) o nódulo redondo completamente encapsulado (nódulo típico de hiperplasia).",
  "Nódulo mayoritariamente encapsulado, nódulo homogéneo circunscrito sin cápsula (atípico) o área homogénea levemente hipointensa entre nódulos.",
  "Señal heterogénea de márgenes mal definidos. Incluye lo que no encaja en 2, 4 o 5.",
  "Lenticular o no circunscrita, homogénea, moderadamente hipointensa y <1,5 cm.",
  "Igual que 4, pero ≥1,5 cm o con extensión extraprostática o invasión definidas.",
];
const DWI = [
  "Sin alteración en el ADC ni en b alto.",
  "Hipointensidad lineal o en cuña en el ADC y/o hiperintensidad lineal o en cuña en b alto.",
  "Foco (distinto del fondo) hipointenso en el ADC y/o hiperintenso en b alto. Puede ser marcado en uno de los dos, pero no en ambos.",
  "Foco marcadamente hipointenso en el ADC y marcadamente hiperintenso en b alto, <1,5 cm.",
  "Igual que 4, pero ≥1,5 cm o con extensión extraprostática o invasión definidas.",
];

function tabla(titulo: string, filas: string[]): HTMLElement {
  return h("section", { class: "tabla-criterios" },
    h("h3", null, titulo),
    h("table", { class: "tabla" },
      h("thead", null, h("tr", null, h("th", { scope: "col" }, "Puntuación"), h("th", { scope: "col" }, "Hallazgo"))),
      h("tbody", null, ...filas.map((t, i) => h("tr", null, h("th", { scope: "row" }, String(i + 1)), h("td", null, t))))));
}

export function vistaSecuencias(el: HTMLElement): void {
  vaciar(
    el,
    h("h1", null, "Módulo 2 · Secuencias y puntuación"),
    h("p", { class: "entradilla" }, "Cada secuencia cuenta una cosa distinta de la misma lesión. PI-RADS v2.1 puntúa cada una por separado y después decide cuál manda según la zona."),
    h("div", { class: "rejilla-secuencias" },
      h("article", { class: "ficha" }, h("h2", null, "T2"),
        h("p", null, "Da la anatomía. La ZP sana es brillante; el cáncer suele verse como un área oscura (hipointensa). En la ZT, entre nódulos de hiperplasia, busca un área homogénea, de márgenes borrosos y sin cápsula (el aspecto de «carboncillo borrado»)."),
        h("p", null, h("strong", null, "Manda en la zona de transición."))),
      h("article", { class: "ficha" }, h("h2", null, "DWI: b alto y ADC"),
        h("p", null, "Mide la difusión del agua. El cáncer, muy celular, la restringe: se ve brillante en b alto (≥1.400 s/mm²) y oscuro en el mapa ADC. Hay que mirar las dos imágenes juntas: para DWI 4 o 5, la lesión tiene que ser marcada en ambas."),
        h("p", null, h("strong", null, "Manda en la zona periférica."))),
      h("article", { class: "ficha" }, h("h2", null, "DCE (contraste)"),
        h("p", null, "Solo es positivo o negativo. En la ZP sube una DWI 3 a PI-RADS 4; en la ZT no cambia nada. Los casos de este curso son biparamétricos (sin contraste): DCE no disponible y una DWI 3 en la ZP se queda en PI-RADS 3."))),
    h("h2", null, "Criterios de puntuación (PI-RADS v2.1)"),
    h("div", { class: "rejilla-criterios" }, tabla("T2 · zona periférica", T2_ZP), tabla("T2 · zona de transición", T2_ZT), tabla("DWI · ambas zonas", DWI)),
    h("p", { class: "nota" }, "Resumen de Turkbey et al., Eur Urol 2019 (PI-RADS v2.1). El tamaño es un criterio: 1,5 cm separa el 4 del 5."),
    h("h2", null, "Qué secuencia manda"),
    h("div", { class: "rejilla-secuencias" },
      h("article", { class: "ficha" }, h("h3", null, "Zona periférica"),
        h("p", null, "Categoría = puntuación de DWI. Con DCE positivo, DWI 3 → PI-RADS 4 (no aplica en RM biparamétrica).")),
      h("article", { class: "ficha" }, h("h3", null, "Zona de transición"),
        h("table", { class: "tabla" },
          h("thead", null, h("tr", null, h("th", { scope: "col" }, "T2"), h("th", { scope: "col" }, "DWI"), h("th", { scope: "col" }, "PI-RADS"))),
          h("tbody", null,
            ...[["1", "cualquiera", "1"], ["2", "≤3", "2"], ["2", "4 o 5", "3"], ["3", "≤4", "3"], ["3", "5", "4"], ["4", "cualquiera", "4"], ["5", "cualquiera", "5"]]
              .map((f) => h("tr", null, ...f.map((t) => h("td", null, t)))))))),
    practica(),
    h("div", { class: "acciones" }, h("a", { class: "boton", href: "#/casos" }, "Siguiente: Módulo 3 · Casos clínicos")),
  );
}

/** Práctica de la regla: zona + T2 + DWI → categoría. */
function practica(): HTMLElement {
  const TOTAL = 8;
  const caja = h("section", { class: "practica", "aria-live": "polite" });
  let n = 0;
  let aciertos = 0;
  const nueva = () => {
    if (n === TOTAL) {
      vaciar(caja, h("h2", null, "Practica la regla"),
        h("p", { class: "cifra-grande" }, `${aciertos} / ${TOTAL}`),
        h("p", null, aciertos === TOTAL ? "Perfecto: dominas la regla. En los casos reales, lo difícil será puntuar cada secuencia." : "Repasa la tabla de la zona de transición: es donde más se falla."),
        h("button", { type: "button", class: "boton", onclick: () => { n = 0; aciertos = 0; nueva(); } }, "Otra ronda"));
      return;
    }
    const zona = Math.random() < 0.45 ? "PZ" : "TZ";
    const t2 = 1 + Math.floor(Math.random() * 5);
    const dwi = 1 + Math.floor(Math.random() * 5);
    const correcta = piradsPorRegla(zona, t2, dwi)!;
    const resultado = h("p", { class: "resultado-practica" });
    const botones = [1, 2, 3, 4, 5].map((v) =>
      h("button", { type: "button", class: "boton secundario", onclick: () => {
        botones.forEach((b) => (b.disabled = true));
        const bien = v === correcta;
        if (bien) aciertos++;
        n++;
        resultado.textContent = bien
          ? `Correcto: PI-RADS ${correcta}.`
          : `No: es PI-RADS ${correcta}. ${zona === "PZ" ? "En la zona periférica manda la DWI." : "En la zona de transición manda T2; la DWI solo sube un 2 a 3 (con DWI ≥4) o un 3 a 4 (con DWI 5)."}`;
        resultado.className = `resultado-practica ${bien ? "ok" : "mal"}`;
        siguiente.hidden = false;
        siguiente.focus();
      } }, String(v)));
    const siguiente = h("button", { type: "button", class: "boton", hidden: true, onclick: nueva }, n + 1 === TOTAL ? "Ver resultado" : "Siguiente");
    vaciar(caja,
      h("h2", null, "Practica la regla"),
      h("p", { class: "nota" }, `Pregunta ${n + 1} de ${TOTAL} · aciertos: ${aciertos}`),
      h("p", { class: "enunciado" }, `Lesión en la ${zona === "PZ" ? "zona periférica" : "zona de transición"}: T2 ${t2}, DWI ${dwi}, sin DCE. ¿Categoría PI-RADS?`),
      h("div", { class: "botones-practica", role: "group", "aria-label": "Categoría" }, ...botones),
      resultado,
      siguiente);
  };
  nueva();
  return caja;
}
