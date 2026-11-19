import { h, vaciar } from "../dom";
import { casos } from "../api";
import { almacen } from "../almacen";
import { ultimos } from "../../shared/progreso";
import { DIFICULTAD, cargando, errorCarga, lineaCaso } from "./comun";

export async function vistaCasos(el: HTMLElement): Promise<void> {
  const lista = h("div", { class: "rejilla-casos" }, cargando());
  vaciar(
    el,
    h("h1", null, "Módulo 3 · Casos clínicos"),
    h("p", { class: "entradilla" },
      "Siete estudios reales de PI-CAI (RM biparamétrica: T2, DWI y ADC, sin contraste). Lee cada caso a ciegas, puntúa, decide y compara tu informe con el del autor."),
    lista,
  );
  let catalogo;
  try {
    catalogo = await casos();
  } catch {
    vaciar(lista, errorCarga());
    return;
  }
  const u = ultimos(almacen.progreso().intentos);
  vaciar(
    lista,
    ...catalogo.map((c) => {
      const ultimo = u.get(c.id);
      const borrador = almacen.borrador(c.id);
      const medio = String(Math.floor(c.tecnica.n_cortes / 2)).padStart(3, "0");
      return h(
        "article",
        { class: "tarjeta-caso" },
        h("div", { class: "miniatura" }, h("img", { src: `/casos/${c.id}/t2w/${medio}.png`, alt: "", loading: "lazy" })),
        h(
          "div",
          { class: "tarjeta-cuerpo" },
          h("h2", null, `Caso ${c.numero}`),
          h("p", { class: "meta" }, `Dificultad ${DIFICULTAD[c.nivel]?.toLowerCase() ?? c.nivel}`),
          h("p", null, lineaCaso(c)),
          ultimo
            ? h("p", { class: "estado" }, `Último intento: ${ultimo.nota} %`, ultimo.critico ? " · error crítico" : ultimo.perfecto ? " · caso perfecto" : "")
            : borrador
              ? h("p", { class: "estado" }, "Lectura en curso")
              : null,
          h(
            "div",
            { class: "acciones" },
            ultimo
              ? [
                  h("a", { class: "boton secundario", href: `#/correccion/${encodeURIComponent(ultimo.id)}` }, "Ver corrección"),
                  h("a", { class: "boton", href: `#/caso/${c.id}` }, borrador ? "Seguir el nuevo intento" : "Nuevo intento"),
                ]
              : h("a", { class: "boton", href: `#/caso/${c.id}` }, borrador ? "Seguir leyendo" : "Empezar el caso"),
          ),
        ),
      );
    }),
  );
}
