import "./estilos.css";
import { h, vaciar } from "./dom";
import { vistaInicio } from "./vistas/inicio";
import { vistaAnatomia } from "./vistas/anatomia";
import { vistaSecuencias } from "./vistas/secuencias";
import { vistaCasos } from "./vistas/casos";
import { vistaCaso } from "./vistas/caso";
import { vistaCorreccion } from "./vistas/correccion";
import { vistaResultados } from "./vistas/resultados";
import { vistaDocente } from "./vistas/docente";
import { vistaMetodo } from "./vistas/metodo";
import { leerRuta, rutaPropia } from "./ruta";

type Vista = (contenedor: HTMLElement, parametro: string) => void | Promise<void>;

const RUTAS: Record<string, { vista: Vista; titulo: string; menu?: string }> = {
  "": { vista: vistaInicio, titulo: "Inicio", menu: "inicio" },
  anatomia: { vista: vistaAnatomia, titulo: "Módulo 1 · Anatomía zonal", menu: "anatomia" },
  secuencias: { vista: vistaSecuencias, titulo: "Módulo 2 · Secuencias y puntuación", menu: "secuencias" },
  casos: { vista: vistaCasos, titulo: "Módulo 3 · Casos clínicos", menu: "casos" },
  caso: { vista: vistaCaso, titulo: "Caso clínico", menu: "casos" },
  correccion: { vista: vistaCorreccion, titulo: "Corrección", menu: "casos" },
  resultados: { vista: vistaResultados, titulo: "Mis resultados", menu: "resultados" },
  docente: { vista: vistaDocente, titulo: "Panel docente", menu: "docente" },
  metodo: { vista: vistaMetodo, titulo: "Método y fuentes", menu: "metodo" },
};

const MENU: Array<[string, string]> = [
  ["inicio", "Inicio"],
  ["anatomia", "1 · Anatomía"],
  ["secuencias", "2 · Secuencias"],
  ["casos", "3 · Casos clínicos"],
  ["resultados", "Mis resultados"],
  ["docente", "Panel docente"],
  ["metodo", "Método"],
];

const app = document.getElementById("app")!;
const contenido = h("main", { id: "contenido", tabindex: -1 });
const navegacion = h("nav", { "aria-label": "Secciones" });
// El router usa el hash: el enlace «Saltar al contenido» no debe cambiarlo.
document.querySelector("a.saltar")?.addEventListener("click", (e) => {
  e.preventDefault();
  contenido.focus();
});
app.append(
  h(
    "header",
    { class: "cabecera" },
    h("a", { class: "marca", href: "#/" }, h("img", { src: "/favicon.svg", alt: "", width: 28, height: 28 }), "Próstata Lab"),
    navegacion,
  ),
  contenido,
  h(
    "footer",
    { class: "pie" },
    h("p", null, "Herramienta docente de lectura de RM de próstata (PI-RADS v2.1). No es un sistema de apoyo a decisiones clínicas."),
    h("p", null, "Imágenes: PI-CAI (Saha et al.), licencia CC BY-NC 4.0. ", h("a", { href: "#/metodo" }, "Método y fuentes"), "."),
  ),
);

let rutaAnterior = "";

function navegar(): void {
  const { hash, nombre, parametro } = leerRuta(location.hash);
  const ruta = rutaPropia(RUTAS, nombre) ?? RUTAS[""]!;
  document.title = `${ruta.titulo} · Próstata Lab`;
  vaciar(
    navegacion,
    h("ul", null, ...MENU.map(([clave, texto]) =>
      h("li", null, h("a", { href: clave === "inicio" ? "#/" : `#/${clave}`, "aria-current": ruta.menu === clave ? "page" : null }, texto)))),
  );
  vaciar(contenido);
  void ruta.vista(contenido, parametro);
  if (hash !== rutaAnterior) {
    window.scrollTo(0, 0);
    if (rutaAnterior) contenido.focus({ preventScroll: true });
  }
  rutaAnterior = hash;
}

window.addEventListener("hashchange", navegar);
navegar();
