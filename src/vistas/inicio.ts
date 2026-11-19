import { h, vaciar } from "../dom";
import { almacen } from "../almacen";
import { resumir } from "../../shared/progreso";

export function vistaInicio(el: HTMLElement): void {
  const p = almacen.progreso();
  const r = resumir(p.intentos);
  const modulo = (n: string, titulo: string, texto: string, href: string, pie: string) =>
    h("a", { class: "tarjeta-modulo", href }, h("span", { class: "numero" }, n), h("h2", null, titulo), h("p", null, texto), h("span", { class: "pie-tarjeta" }, pie));
  vaciar(
    el,
    h("section", { class: "portada" },
      h("h1", null, "Aprende a leer la RM de próstata con casos reales"),
      h("p", { class: "entradilla" },
        "Tres módulos: dónde está cada zona, cómo se puntúa cada secuencia y, por último, siete estudios reales de PI-CAI que lees a ciegas y comparas con la lectura del autor."),
      h("div", { class: "acciones" },
        h("a", { class: "boton", href: r.casos ? "#/casos" : "#/anatomia" }, r.casos ? "Seguir con los casos" : "Empezar"),
        r.casos ? h("a", { class: "boton secundario", href: "#/resultados" }, "Mis resultados") : null)),
    h("div", { class: "rejilla-modulos" },
      modulo("1", "Anatomía zonal", "Recorre una próstata real en T2 con la zona periférica y la de transición superpuestas, y aprende el mapa de 38 sectores.", "#/anatomia", "5 estudios"),
      modulo("2", "Secuencias y puntuación", "Qué aporta T2, la DWI y el ADC, los criterios de PI-RADS v2.1 y qué secuencia manda en cada zona. Con práctica de la regla.", "#/secuencias", "Criterios y práctica"),
      modulo("3", "Casos clínicos", "Contexto, lectura, sectores, puntuación, categoría y decisión. La corrección compara tu informe con el del autor, campo a campo.", "#/casos",
        r.casos ? `${r.casos} de 7 casos leídos · media ${r.notaMedia} %` : "7 estudios reales")),
    h("section", { class: "avisos-portada" },
      h("p", null, h("strong", null, "Tu progreso se queda en este navegador. "), "No hace falta cuenta. Desde «Mis resultados» puedes exportarlo y entregárselo a tu docente."),
      h("p", null, h("strong", null, "Herramienta docente. "), "No es un sistema de apoyo a decisiones clínicas. Las lecturas de referencia son del autor; el desenlace procede de PI-CAI.")),
  );
}
