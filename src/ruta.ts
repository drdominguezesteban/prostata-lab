/** Lee el hash del router: «#/caso/ID» → { nombre: "caso", parametro: "ID" }. Nunca lanza. */
export function leerRuta(hashCompleto: string): { hash: string; nombre: string; parametro: string } {
  const hash = hashCompleto.replace(/^#\/?/, "");
  const [nombre = "", ...resto] = hash.split("/");
  const crudo = resto.join("/");
  let parametro: string;
  try {
    parametro = decodeURIComponent(crudo);
  } catch {
    // «%» suelto o una secuencia mal formada: se usa tal cual (la vista dirá que no lo encuentra).
    parametro = crudo;
  }
  return { hash, nombre, parametro };
}

/** Busca una ruta solo entre las claves propias: «#/constructor» o «#/toString» no son vistas. */
export function rutaPropia<T>(rutas: Record<string, T>, nombre: string): T | undefined {
  return Object.hasOwn(rutas, nombre) ? rutas[nombre] : undefined;
}
