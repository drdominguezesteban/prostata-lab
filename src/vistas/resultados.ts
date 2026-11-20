import { botonConfirmar, descargar, fecha, h, vaciar } from "../dom";
import { almacen } from "../almacen";
import { casos } from "../api";
import { ETIQUETAS, PESOS, type Componente } from "../../shared/puntuacion";
import { mejoraEnRepetidos, resumir, ultimos } from "../../shared/progreso";
import { guardarSeudonimo, prepararExportacion, recuperarCopia } from "../archivos";
import type { CasoPublico } from "../../shared/servidor";
import { barra, porcentaje } from "./comun";

export async function vistaResultados(el: HTMLElement): Promise<void> {
  let catalogo: CasoPublico[] = [];
  try {
    catalogo = await casos();
  } catch {
    /* se muestran los ids */
  }
  pintar(el, catalogo);
}

function pintar(el: HTMLElement, catalogo: CasoPublico[], aviso = ""): void {
  const guardado = almacen.progreso();
  // Solo cuentan los intentos de casos que existen (si el catálogo ha cargado).
  const p = catalogo.length ? { ...guardado, intentos: guardado.intentos.filter((i) => catalogo.some((c) => c.id === i.caso)) } : guardado;
  const r = resumir(p.intentos);
  const u = ultimos(p.intentos);
  const numero = (id: string) => catalogo.find((c) => c.id === id)?.numero ?? id;
  const mejora = mejoraEnRepetidos(p.intentos);

  const seud = h("input", { id: "seudonimo", type: "text", value: p.seudonimo, maxlength: 24, autocomplete: "off", "aria-describedby": "seud-ayuda seud-estado" });
  const estadoSeud = h("p", { class: "error-campo", id: "seud-estado", role: "status" });
  const guardarSeud = (): boolean => {
    const r = guardarSeudonimo(seud.value);
    estadoSeud.textContent = r.mensaje;
    return r.ok;
  };

  const importar = h("input", { type: "file", accept: "application/json,.json", class: "oculto", id: "importar-propio" });
  importar.addEventListener("change", async () => {
    const f = importar.files?.[0];
    if (!f) return;
    const r = await recuperarCopia(f, catalogo.length ? catalogo.map((c) => c.id) : null);
    pintar(el, catalogo, r.mensaje);
  });

  const repasar = [...u.values()].filter((i) => i.critico || i.nota < 70).sort((a, b) => a.nota - b.nota);

  vaciar(
    el,
    h("h1", null, "Mis resultados"),
    h("p", { class: "entradilla" }, "Tu progreso se guarda solo en este navegador. Para no perderlo, o para entregárselo a tu docente, expórtalo como archivo."),
    h("section", { class: "tarjetas-cifras" },
      cifra(`${r.casos} / ${catalogo.length || 7}`, "casos leídos"),
      cifra(r.notaMedia === null ? "—" : `${r.notaMedia}`, "nota media (último intento)"),
      cifra(String(r.perfectos), "casos perfectos"),
      cifra(String(r.criticos), "errores críticos"),
      cifra(`${r.minutos} min`, "de práctica")),
    mejora ? h("p", null, `En los ${mejora.casos} casos que has repetido, la nota ha pasado de ${mejora.primero} a ${mejora.ultimo} de media.`) : null,

    h("h2", null, "Por componente"),
    r.casos
      ? h("table", { class: "tabla" },
          h("thead", null, h("tr", null, h("th", { scope: "col" }, "Componente"), h("th", { scope: "col" }, "Acierto medio"), h("th", { scope: "col", class: "oculto-movil" }, ""))),
          h("tbody", null, ...(Object.keys(PESOS) as Componente[]).map((c) => h("tr", { class: c === r.flojo ? "flojo" : "" },
            h("th", { scope: "row" }, ETIQUETAS[c], c === r.flojo ? " · lo que más te cuesta" : ""),
            h("td", null, porcentaje(r.componentes[c])),
            h("td", { class: "oculto-movil" }, barra(r.componentes[c], ETIQUETAS[c]))))))
      : h("p", null, "Aún no has terminado ningún caso. ", h("a", { href: "#/casos" }, "Empieza por el caso 1"), "."),

    repasar.length
      ? [h("h2", null, "Para repasar"),
          h("ul", { class: "lista-repaso" }, ...repasar.map((i) => h("li", null,
            h("a", { href: `#/correccion/${encodeURIComponent(i.id)}` }, `Caso ${numero(i.caso)}`),
            `: ${i.nota} %`, i.critico ? " con error crítico en la decisión" : "", ". ",
            h("a", { href: `#/caso/${i.caso}` }, "Repetir"))))]
      : null,

    p.intentos.length
      ? [h("h2", null, "Historial"),
          h("table", { class: "tabla" },
            h("thead", null, h("tr", null, h("th", { scope: "col" }, "Fecha"), h("th", { scope: "col" }, "Caso"), h("th", { scope: "col" }, "Nota"), h("th", { scope: "col" }, "Minutos"), h("th", { scope: "col" }, ""))),
            h("tbody", null, ...[...p.intentos].reverse().map((i) => h("tr", null,
              h("td", null, fecha(i.fin)),
              h("td", null, `Caso ${numero(i.caso)}`),
              h("td", null, `${i.nota} %`, i.critico ? " · crítico" : i.perfecto ? " · perfecto" : ""),
              h("td", null, String(Math.max(1, Math.round(i.segundos / 60)))),
              h("td", null, h("a", { href: `#/correccion/${encodeURIComponent(i.id)}` }, "Ver"))))))]
      : null,

    h("h2", null, "Guardar y entregar"),
    h("div", { class: "campo" },
      h("label", { for: "seudonimo" }, "Seudónimo"),
      h("div", { class: "en-linea" }, seud, h("button", { type: "button", class: "boton secundario", onclick: guardarSeud }, "Guardar")),
      h("p", { class: "ayuda", id: "seud-ayuda" }, "Lo verá tu docente en su panel. No pongas tu nombre: usa uno que solo él o ella pueda relacionar contigo (p. ej. «R2-azul»)."),
      estadoSeud),
    h("div", { class: "acciones" },
      h("button", { type: "button", class: "boton", disabled: !p.intentos.length, "aria-describedby": "aviso-lectura-libre", onclick: () => {
        const r = prepararExportacion(seud.value);
        estadoSeud.textContent = r.ok ? r.aviso : r.mensaje;
        if (r.ok) descargar(r.nombre, r.contenido, "application/json");
      } }, "Exportar mi progreso"),
      h("label", { class: "boton secundario", for: "importar-propio" }, "Recuperar una copia"),
      importar,
      botonConfirmar("Borrar mi progreso", "Pulsa otra vez para borrarlo todo", () => { almacen.borrarProgreso(); pintar(el, catalogo); })),
    h("p", { class: "nota", id: "aviso-lectura-libre" }, "Tu docente verá también tu lectura libre. No escribas datos de pacientes ni tu nombre."),
    h("p", { class: "nota estado-importacion", role: "status" }, aviso),
  );
}

function cifra(valor: string, texto: string): HTMLElement {
  return h("div", { class: "cifra-tarjeta" }, h("strong", null, valor), h("span", null, texto));
}
