import { h, num, vaciar } from "../dom";
import { casos, corregir } from "../api";
import { almacen } from "../almacen";
import { Visor, type Contorno, type MarcaVisor } from "../visor";
import { mapaSectores } from "../mapa";
import { informeAlumno } from "../informe";
import { NOMBRE_ZONA_LARGA, nombreSector, zonaPrincipal } from "../../shared/sectores";
import { PENALIZACION_ERROR_CRITICO, type Pareja } from "../../shared/puntuacion";
import { cargando, errorCarga, porcentaje, barra } from "./comun";
import { notaVisor } from "./caso";

const REF = "#ef4444";
const TUYA = "#facc15";

export async function vistaCorreccion(el: HTMLElement, id: string): Promise<void> {
  const intento = almacen.progreso().intentos.find((i) => i.id === id);
  if (!intento) {
    vaciar(el, h("p", { class: "aviso" }, "No encuentro ese intento en este navegador. ", h("a", { href: "#/casos" }, "Volver a los casos")));
    return;
  }
  vaciar(el, cargando("Corrigiendo…"));
  let catalogo;
  try {
    catalogo = await casos();
  } catch {
    vaciar(el, errorCarga());
    return;
  }
  const caso = catalogo.find((c) => c.id === intento.caso);
  if (!caso) {
    // No es un fallo de conexión: el intento es de un caso que no está en el catálogo.
    vaciar(el, h("p", { class: "aviso" }, "Este intento es de un caso que no está en Próstata Lab, así que no se puede corregir. ", h("a", { href: "#/resultados" }, "Volver a mis resultados")));
    return;
  }
  let r;
  try {
    r = await corregir(caso.id, intento.lectura);
  } catch {
    vaciar(el, errorCarga());
    return;
  }
  const { resultado: res, referencia: ref } = r;
  const l = intento.lectura;

  // Visor con la referencia (rojo) y tus marcas (amarillo)
  const contornos: Contorno[] = ref.geometria.lesiones.flatMap((g) =>
    Object.entries(g.contornos_px).map(([k, polys]) => ({ corte: Number(k), polys, color: REF })));
  const primera = ref.geometria.lesiones[0];
  const visor = new Visor({
    caso: caso.id,
    nCortes: caso.tecnica.n_cortes,
    secuencias: ["t2w", "adc", "hbv"],
    rotulos: { hbv: `b ${caso.tecnica.b_alto}` },
    corte: primera?.corte_referencia ?? l.lesiones.find((x) => x.marca)?.marca?.corte,
  });
  const marcas: MarcaVisor[] = l.lesiones.filter((x) => x.marca).map((x) => ({ ...x.marca!, etiqueta: `Tu ${x.id}`, color: TUYA }));
  visor.ponerMarcas(marcas);
  let verRef = true;
  visor.ponerContornos(contornos);
  const alternarRef = h("label", { class: "interruptor" },
    h("input", { type: "checkbox", checked: true, onchange: () => { verRef = !verRef; visor.ponerContornos(verRef ? contornos : []); } }),
    " Contorno de referencia (máscara PI-CAI)");

  const cabecera = h("div", { class: "nota-final" + (res.critico ? " critica" : res.perfecto ? " perfecta" : "") },
    h("p", { class: "cifra" }, `${res.nota}`, h("span", null, " / 100")),
    h("div", null,
      res.critico
        ? h("p", null, h("strong", null, "Decisión marcada como error crítico. "), ref.decision.explicacion)
        : res.perfecto
          ? h("p", null, h("strong", null, "Caso perfecto."))
          : null,
      h("p", { class: "nota" }, `Tiempo de lectura: ${Math.max(1, Math.round(intento.segundos / 60))} min.`)));

  const tablaComponentes = h("table", { class: "tabla" },
    h("thead", null, h("tr", null, h("th", { scope: "col" }, "Componente"), h("th", { scope: "col" }, "Peso"), h("th", { scope: "col" }, "Acierto"), h("th", { scope: "col", class: "oculto-movil" }, ""))),
    h("tbody", null,
      ...res.componentes.map((c) => h("tr", { class: c.valor === null ? "no-aplica" : "" },
        h("td", null, c.etiqueta),
        h("td", null, String(c.peso)),
        h("td", null, c.valor === null ? "No aplica" : porcentaje(c.valor)),
        h("td", { class: "oculto-movil" }, c.valor === null ? "" : barra(c.valor, c.etiqueta)))),
      res.critico ? h("tr", { class: "penalizacion" }, h("td", null, "Penalización por error crítico"), h("td", null, ""), h("td", null, `−${PENALIZACION_ERROR_CRITICO}`), h("td", { class: "oculto-movil" }, "")) : null));

  const comentarios = [
    ...res.comentarios,
    ...res.erroresRegla.map((e) => `Error de regla en tu ${e.lesion}: con tus propias puntuaciones de T2 y DWI, la categoría según PI-RADS v2.1 es ${e.esperado}, no ${e.puesto}.`),
  ];

  vaciar(
    el,
    h("p", { class: "migas" }, h("a", { href: "#/casos" }, "Casos clínicos"), ` / Caso ${caso.numero} / Corrección`),
    h("h1", null, `Caso ${caso.numero} · corrección`),
    cabecera,
    h("div", { class: "disposicion-caso" },
      h("div", { class: "columna-visor" }, visor.el, alternarRef, notaVisor(caso),
        h("p", { class: "nota" }, h("span", { class: "muestra", style: `background:${REF}` }), " Referencia  ", h("span", { class: "muestra", style: `background:${TUYA}` }), " Tus marcas")),
      h("div", { class: "panel-paso" },
        h("h2", null, "Desglose"),
        tablaComponentes,
        comentarios.length ? h("section", { class: "comentarios" }, h("h3", null, "Comentarios del autor"), h("ul", null, ...comentarios.map((t) => h("li", null, t)))) : null)),
    h("h2", null, "Lesiones: tu lectura frente a la del autor"),
    res.parejas.length
      ? res.parejas.map((p) => bloquePareja(p, visor))
      : h("p", null, "Ni tú ni el autor habéis descrito lesiones sospechosas: estudio negativo. ✓"),
    h("h2", null, "Mapa de sectores"),
    h("div", { class: "dos-mapas" },
      h("figure", null, mapaSectores({ soloLectura: true, seleccion: l.lesiones.flatMap((x) => x.sectores), etiqueta: "Tus sectores" }), h("figcaption", null, "Tus sectores")),
      h("figure", null, mapaSectores({ soloLectura: true, referencia: ref.lesiones.flatMap((x) => x.sectores), etiqueta: "Sectores de referencia" }), h("figcaption", null, "Referencia del autor"))),
    h("h2", null, "Estudio y decisión"),
    h("table", { class: "tabla campo-a-campo" },
      h("thead", null, h("tr", null, h("th", { scope: "col" }, "Campo"), h("th", { scope: "col" }, "Tu respuesta"), h("th", { scope: "col" }, "Referencia"), h("th", { scope: "col" }, ""))),
      h("tbody", null,
        fila("Densidad de PSA", l.psad === null ? "—" : num(l.psad, 2), num(ref.psad, 2), res.componentes.find((c) => c.clave === "psad")?.valor === 1),
        fila("Categoría PI-RADS del estudio", l.categoria ? `PI-RADS ${l.categoria}` : "—", `PI-RADS ${ref.categoria}`, l.categoria === ref.categoria),
        fila("Decisión", caso.opciones.find((o) => o.id === l.decision)?.texto ?? "—",
          ref.decision.correcta.map((id) => caso.opciones.find((o) => o.id === id)?.texto).join(" / ") +
            (ref.decision.aceptable.length ? ` (aceptable: ${ref.decision.aceptable.map((id) => caso.opciones.find((o) => o.id === id)?.texto).join(" / ")})` : ""),
          res.decision === "correcta" ? true : res.decision === "aceptable" ? "medio" : false))),
    h("p", null, ref.decision.explicacion),
    h("p", { class: "nota" }, h("strong", null, "Vía de biopsia. "), ref.decision.via_preferente),
    h("h2", null, "Informes"),
    h("div", { class: "dos-informes" },
      h("section", null, h("h3", null, "Tu informe"), h("pre", { class: "informe" }, informeAlumno(caso, l)),
        l.impresion ? [h("h4", null, "Tu lectura libre"), h("p", { class: "cita" }, l.impresion)] : null),
      h("section", null, h("h3", null, "Informe del autor"), h("pre", { class: "informe" }, ref.informe))),
    h("h2", null, "Desenlace real"),
    h("p", null, h("strong", null, "Estrato de referencia: "), `${ref.estrato}. `, ref.desenlace),
    ref.medicion ? h("p", { class: "nota" }, ref.medicion) : null,
    h("div", { class: "acciones" },
      h("a", { class: "boton", href: `#/caso/${caso.id}` }, "Nuevo intento"),
      h("a", { class: "boton secundario", href: "#/casos" }, "Volver a los casos"),
      h("a", { class: "boton secundario", href: "#/resultados" }, "Mis resultados")),
  );
}

function marca(ok: boolean | "medio"): HTMLElement {
  return ok === "medio"
    ? h("span", { class: "medio", title: "Parcial" }, "≈")
    : ok ? h("span", { class: "ok", title: "Coincide" }, "✓") : h("span", { class: "mal", title: "No coincide" }, "✗");
}

function fila(campo: string, tuyo: string, refe: string, ok: boolean | "medio"): HTMLElement {
  return h("tr", null, h("th", { scope: "row" }, campo), h("td", null, tuyo), h("td", null, refe), h("td", null, marca(ok)));
}

function cercania(a: number | null, b: number): boolean | "medio" {
  if (a === null) return false;
  return a === b ? true : Math.abs(a - b) === 1 ? "medio" : false;
}

function bloquePareja(p: Pareja, visor: Visor): HTMLElement {
  const a = p.alumno;
  const r = p.referencia;
  const titulo =
    a && r
      ? p.tipo === "coincide"
        ? `Tu ${a.id} ↔ Referencia ${r.id}`
        : `Tu ${a.id} · cercana a Referencia ${r.id} (sector contiguo)`
      : a
        ? `Tu ${a.id} · sin correspondencia (falso positivo)`
        : `Referencia ${r!.id} · no marcada (omitida)`;
  const t = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const tam = (v: string | null | undefined) => (v === ">=1.5" ? "≥1,5 cm" : v === "<1.5" ? "<1,5 cm" : "—");
  const za = a ? zonaPrincipal(a.sectores) : null;
  const filas = [
    fila("Sectores", a ? a.sectores.map(nombreSector).join("; ") : "—", r ? r.sectores.map(nombreSector).join("; ") : "Sin lesión",
      a && r ? (p.tipo === "coincide" ? (p.solape === 1 ? true : "medio") : "medio") : false),
    fila("Zona", za ? NOMBRE_ZONA_LARGA[za] : "—", r ? NOMBRE_ZONA_LARGA[r.zona] : "—", !!(a && r && za === r.zona)),
    fila("T2", t(a?.t2), t(r?.t2), r ? cercania(a?.t2 ?? null, r.t2) : false),
    fila("DWI", t(a?.dwi), t(r?.dwi), r ? cercania(a?.dwi ?? null, r.dwi) : false),
    fila("DCE", "No disponible", "No disponible", true),
    fila("Tamaño", tam(a?.tamano), tam(r?.tamano), !!(a && r && a.tamano === r.tamano)),
    fila("Extensión extraprostática", a?.epe === "definida" ? "Definida" : a?.epe === "no" ? "No definida" : "—",
      r ? (r.epe === "definida" ? "Definida" : "No definida") : "—", !!(a && r && a.epe === r.epe)),
    fila("PI-RADS", t(a?.pirads), t(r?.pirads_global), r ? cercania(a?.pirads ?? null, r.pirads_global) : false),
  ];
  return h("section", { class: `pareja pareja-${p.tipo}` },
    h("h3", null, titulo,
      a?.marca ? h("button", { type: "button", class: "enlace", onclick: () => { visor.centrarEn(a.marca!.corte, a.marca!.x, a.marca!.y); visor.el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } }, ` Ver tu marca (corte ${a.marca.corte + 1})`) : null),
    h("table", { class: "tabla campo-a-campo" },
      h("thead", null, h("tr", null, h("th", { scope: "col" }, "Campo"), h("th", { scope: "col" }, a ? `Tu ${a.id}` : "Tú"), h("th", { scope: "col" }, r ? `Referencia ${r.id}` : "Referencia"), h("th", { scope: "col" }, ""))),
      h("tbody", null, ...filas)),
    r ? h("p", { class: "explicacion" }, r.explicacion) : null);
}
