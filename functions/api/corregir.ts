import { corregirPeticion } from "../../shared/servidor";
import { leerJson, respuesta } from "../../shared/http";

const LIMITE = 64_000;

export const onRequestPost: PagesFunction = async ({ request }) => {
  const r = await leerJson(request, LIMITE);
  if (!r.ok) return r.respuesta;
  const c = corregirPeticion(r.cuerpo);
  return respuesta(c.estado, c.json);
};
