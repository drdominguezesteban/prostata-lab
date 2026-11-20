import { botonConfirmar, descargar, fecha, h, vaciar } from "../dom";
import { almacen } from "../almacen";
import { casos, recorregir } from "../api";
import { ETIQUETAS } from "../../shared/puntuacion";
import { anadirAlGrupo, aplicarNotas, csvGrupo, leerExportacion, resumenPorCaso, resumir, ultimos } from "../../shared/progreso";
import type { CasoPublico } from "../../shared/servidor";

export async function vistaDocente(el: HTMLElement): Promise<void> {
  let catalogo: CasoPublico[] = [];
  try {
    catalogo = await casos();
  } catch {
    /* sin números de caso */
  }
  pintar(el, catalogo, []);
}

function pintar(el: HTMLElement, catalogo: CasoPublico[], mensajes: string[]): void {
  const g = almacen.grupo();
  const ids = catalogo.map((c) => c.id);
  const alumnos = Object.entries(g.alumnos).sort(([a], [b]) => a.localeCompare(b, "es"));

  const entrada = h("input", { type: "file", accept: "application/json,.json", multiple: true, id: "archivos-alumnos", class: "oculto" });
  const cargar = async (archivos: FileList | File[]) => {
    let grupo = almacen.grupo();
    const avisos: string[] = [];
    for (const f of Array.from(archivos)) {
      const r = leerExportacion(await f.text());
      if (!r.ok) {
        avisos.push(`${f.name}: ${r.mensaje}`);
        continue;
      }
      // La nota del archivo no se usa: el alumno podría haberla editado. Se corrige de nuevo en el servidor.
      let notas;
      try {
        notas = await recorregir(r.datos.intentos.map((i) => ({ caso: i.caso, lectura: i.lectura })));
      } catch {
        avisos.push(`${f.name}: no se ha podido verificar con el servidor. No se ha importado; inténtalo de nuevo.`);
        continue;
      }
      const v = aplicarNotas(r.datos.intentos, notas);
      const res = anadirAlGrupo(grupo, { ...r.datos, intentos: v.intentos });
      grupo = res.grupo;
      const extra = [
        v.cambiadas ? `${v.cambiadas} con la nota recalculada en el servidor, distinta de la del archivo` : "",
        v.descartados ? `${v.descartados} descartados por no ser válidos` : "",
      ].filter(Boolean).join("; ");
      avisos.push(`${f.name}: ${v.intentos.length} intentos de «${res.seudonimo}»${extra ? ` (${extra})` : ""}.`);
    }
    almacen.guardarGrupo(grupo);
    pintar(el, catalogo, avisos);
  };
  entrada.addEventListener("change", () => entrada.files && void cargar(entrada.files));
  const zona = h("label", { class: "zona-soltar", for: "archivos-alumnos" },
    h("strong", null, "Añadir archivos de progreso"), h("span", null, "Arrástralos aquí o pulsa para elegirlos (se pueden varios a la vez)."));
  zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("encima"); });
  zona.addEventListener("dragleave", () => zona.classList.remove("encima"));
  zona.addEventListener("drop", (e) => { e.preventDefault(); zona.classList.remove("encima"); if (e.dataTransfer?.files) void cargar(e.dataTransfer.files); });

  const quitar = (s: string) => {
    const grupo = almacen.grupo();
    delete grupo.alumnos[s];
    almacen.guardarGrupo(grupo);
    pintar(el, catalogo, [`«${s}» quitado del panel.`]);
  };

  vaciar(
    el,
    h("h1", null, "Panel docente"),
    h("p", { class: "entradilla" },
      "Cada alumno exporta su progreso desde «Mis resultados» y te envía el archivo. Aquí los reúnes para ver el grupo. ",
      "Los datos se quedan en este navegador: no se suben a ningún servidor."),
    h("p", { class: "nota" }, "Los archivos solo llevan un seudónimo. Si alguno trae un nombre real, pide al alumno que lo cambie y vuelva a exportar."),
    zona,
    entrada,
    mensajes.length ? h("ul", { class: "mensajes", role: "status" }, ...mensajes.map((m) => h("li", null, m))) : null,
    alumnos.length
      ? [
          h("h2", null, `Alumnos (${alumnos.length})`),
          h("div", { class: "tabla-desplazable" },
            h("table", { class: "tabla" },
              h("thead", null, h("tr", null,
                ...["Seudónimo", "Casos", "Nota media", "Críticos", "Perfectos", "Minutos", "Le cuesta más", ...catalogo.map((c) => `C${c.numero}`), "Importado", ""].map((t) => h("th", { scope: "col" }, t)))),
              h("tbody", null, ...alumnos.map(([s, a]) => {
                const r = resumir(a.intentos);
                const u = ultimos(a.intentos);
                return h("tr", null,
                  h("th", { scope: "row" }, s),
                  h("td", null, `${r.casos}/${ids.length || "?"}`),
                  h("td", null, r.notaMedia === null ? "—" : String(r.notaMedia)),
                  h("td", null, String(r.criticos)),
                  h("td", null, String(r.perfectos)),
                  h("td", null, String(r.minutos)),
                  h("td", null, r.flojo ? ETIQUETAS[r.flojo] : "—"),
                  ...ids.map((id) => {
                    const i = u.get(id);
                    return h("td", { class: i?.critico ? "critico" : "" }, i ? String(i.nota) : "—");
                  }),
                  h("td", null, fecha(a.importado)),
                  h("td", null, botonConfirmar("Quitar", "¿Seguro?", () => quitar(s), "enlace")));
              })))),
          h("h2", null, "Por caso"),
          h("table", { class: "tabla" },
            h("thead", null, h("tr", null, ...["Caso", "Alumnos", "Nota media", "Errores críticos", "Componente más flojo"].map((t) => h("th", { scope: "col" }, t)))),
            h("tbody", null, ...resumenPorCaso(g, ids).map((f) => h("tr", null,
              h("th", { scope: "row" }, `Caso ${catalogo.find((c) => c.id === f.caso)?.numero ?? f.caso}`),
              h("td", null, String(f.alumnos)),
              h("td", null, f.notaMedia === null ? "—" : String(f.notaMedia)),
              h("td", null, String(f.criticos)),
              h("td", null, f.flojo ? ETIQUETAS[f.flojo] : "—"))))),
          h("p", { class: "nota" }, "Cuenta el último intento de cada alumno en cada caso. Las celdas en rojo son decisiones con error crítico."),
          h("div", { class: "acciones" },
            h("button", { type: "button", class: "boton secundario", onclick: () => descargar(`prostata-lab-grupo-${new Date().toISOString().slice(0, 10)}.csv`, "﻿" + csvGrupo(g, ids), "text/csv") }, "Descargar tabla (CSV)"),
            botonConfirmar("Vaciar el panel", "Pulsa otra vez para vaciarlo", () => { almacen.guardarGrupo({ version: 1, alumnos: {} }); pintar(el, catalogo, []); })),
        ]
      : h("p", null, "Todavía no has añadido ningún archivo."),
  );
}
