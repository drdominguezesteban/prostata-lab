import { h, vaciar } from "../dom";
import { CREDITO_ADYACENTE, CREDITO_DETECCION_PARCIAL, ETIQUETAS, PENALIZACION_ERROR_CRITICO, PENALIZACION_FALSO_POSITIVO, PESOS, UMBRAL_PERFECTO, type Componente } from "../../shared/puntuacion";

export function vistaMetodo(el: HTMLElement): void {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  vaciar(
    el,
    h("h1", null, "Método y fuentes"),
    h("h2", null, "Para qué sirve"),
    h("p", null, "Próstata Lab entrena la lectura estructurada de la RM biparamétrica de próstata con PI-RADS v2.1: localizar, puntuar cada secuencia, aplicar la regla de la zona, decidir y redactar el informe. Es una herramienta docente: no es un sistema de apoyo a decisiones clínicas y no sirve para informar estudios de pacientes."),

    h("h2", null, "Cómo se corrige"),
    h("p", null, "La corrección se hace en el servidor después de enviar la lectura: las respuestas del autor no viajan al navegador antes. La nota (0–100) suma seis componentes, que se puntúan siempre por separado:"),
    h("table", { class: "tabla" },
      h("thead", null, h("tr", null, h("th", { scope: "col" }, "Componente"), h("th", { scope: "col" }, "Peso"), h("th", { scope: "col" }, "Cómo se puntúa"))),
      h("tbody", null,
        ...([
          ["deteccion", `Lesiones de referencia encontradas. Cuenta como el ${pct(CREDITO_DETECCION_PARCIAL)} de una lesión si se marca solo en un sector contiguo o si menos de la mitad de los sectores marcados caen en ella. Cada lesión marcada sin correspondencia resta ${pct(PENALIZACION_FALSO_POSITIVO)} de una lesión. En un estudio negativo, cada falso positivo resta la mitad.`],
          ["localizacion", `Solape de sectores con la lesión de referencia (coeficiente de Dice): marcar sectores de más o de menos lo reduce. Si la lesión está en un sector contiguo sin compartir ninguno, ${pct(CREDITO_ADYACENTE)}.`],
          ["secuencias", "T2, DWI y tamaño de cada lesión encontrada. Acertar vale 1; equivocarse en un punto, 0,5."],
          ["pirads", "Categoría del estudio. Exacta, 1; a un punto, 0,5. Se puntúa aunque la lesión no se haya emparejado."],
          ["psad", "Densidad de PSA con dos decimales (se tolera el redondeo)."],
          ["decision", "Opción preferente, 1; aceptable, 0,5; otra, 0."],
        ] as Array<[Componente, string]>).map(([c, t]) => h("tr", null, h("th", { scope: "row" }, ETIQUETAS[c]), h("td", null, String(PESOS[c])), h("td", null, t))))),
    h("ul", null,
      h("li", null, "Solo cuentan como lesiones tuyas las de PI-RADS ≥3. Puedes anotar una lesión de categoría 1–2 sin que te reste."),
      h("li", null, "En un estudio sin lesiones, localización y secuencias no aplican y el resto de componentes se reescala a 100."),
      h("li", null, `Error crítico (una decisión opuesta a la indicada, p. ej. no biopsiar un PI-RADS 4): la decisión vale 0 y se restan ${PENALIZACION_ERROR_CRITICO} puntos al total. El resto de componentes sigue contando, para que veas en qué acertaste.`),
      h("li", null, `Caso perfecto: ${UMBRAL_PERFECTO} puntos o más, sin error crítico.`),
      h("li", null, "Error de regla: si tu categoría no sigue PI-RADS v2.1 con tus propias puntuaciones de T2 y DWI, la corrección te lo señala aparte del error de lectura.")),

    h("h2", null, "De dónde salen los casos"),
    h("ul", null,
      h("li", null, h("strong", null, "Imágenes: "), "PI-CAI Public Training and Development Dataset (Saha A, et al. Artificial intelligence and radiologists in prostate cancer detection on MRI (PI-CAI): an international, paired, non-inferiority, confirmatory study. Lancet Oncol 2024;25:879-887), licencia CC BY-NC 4.0, ",
        h("a", { href: "https://zenodo.org/records/6624726", rel: "noopener" }, "zenodo.org/records/6624726"), ". Máscaras de cáncer y zonales: picai_labels. Por esa licencia, Próstata Lab es de uso docente y no comercial."),
      h("li", null, h("strong", null, "Preparación: "), "recorte centrado en la glándula, ventana fija y exportación a PNG de 8 bits. El ADC y la imagen de b alto se han remuestreado (en milímetros) a la geometría de T2: el mismo píxel y corte es el mismo punto anatómico en las tres secuencias."),
      h("li", null, h("strong", null, "Datos clínicos: "), "edad, PSA y volumen proceden de PI-CAI. Tacto rectal, antecedentes, biopsias previas y medicación se han completado con fines docentes."),
      h("li", null, h("strong", null, "Lecturas de referencia: "), "del autor, con el contorno de la máscara de PI-CAI y el desenlace histológico como apoyo. Están pendientes de validación por un radiólogo."),
      h("li", null, h("strong", null, "Guías: "), "PI-RADS v2.1 (Turkbey B, et al. Eur Urol 2019;76:340-351) y Guía EAU de cáncer de próstata 2026 (apartados 5.5.8 y 5.6.4).")),

    h("h2", null, "Limitaciones"),
    h("ul", null,
      h("li", null, "Siete casos: sirven para entrenar el método, no para medir la competencia de un lector."),
      h("li", null, "Las imágenes son PNG de 8 bits con una ventana fija: el brillo y el contraste del visor no recuperan toda la información del estudio original."),
      h("li", null, "Estudios biparamétricos: sin DCE.")),

    h("h2", null, "Privacidad"),
    h("p", null, "No hay cuentas. Tu progreso y el panel docente se guardan en tu navegador. Para corregir, el servidor recibe tu lectura (sectores, puntuaciones y decisión), la compara con la referencia y no la guarda. El archivo que exportas solo lleva el seudónimo que elijas. No hay forma de subir imágenes de pacientes, y no se debe escribir ningún dato de pacientes en la lectura libre."),
  );
}
