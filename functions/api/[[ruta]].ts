import { noEncontrado } from "../../shared/http";

/** Cualquier otra ruta bajo /api/: 404 en JSON, no la portada de la web. */
export const onRequest: PagesFunction = () => noEncontrado();
