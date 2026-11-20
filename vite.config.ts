import { defineConfig, type Plugin } from "vite";
import { catalogo, corregirPeticion, recorregirLote } from "./shared/servidor";

/** En `vite` no hay funciones de Pages: el mismo código responde desde el servidor de desarrollo. */
function apiLocal(): Plugin {
  return {
    name: "prostata-lab-api-local",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const ruta = req.url?.split("?")[0] ?? "";
        res.setHeader("content-type", "application/json; charset=utf-8");
        if (ruta === "/api/casos" && req.method === "GET") {
          res.end(JSON.stringify(catalogo()));
          return;
        }
        const rutasPost: Record<string, typeof corregirPeticion | typeof recorregirLote> = { "/api/corregir": corregirPeticion, "/api/recorregir": recorregirLote };
        const manejador = req.method === "POST" ? rutasPost[ruta] : undefined;
        if (manejador) {
          let cuerpo = "";
          req.on("data", (d: Buffer) => (cuerpo += d.toString("utf-8")));
          req.on("end", () => {
            try {
              const r = manejador(JSON.parse(cuerpo));
              res.statusCode = r.estado;
              res.end(JSON.stringify(r.json));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, mensaje: "La petición no es JSON." }));
            }
          });
          return;
        }
        // Igual que en Pages: una ruta de la API con otro método da 405 y una que no existe, 404 (en JSON).
        if (ruta.startsWith("/api/")) {
          const conocida = ruta === "/api/casos" || ruta in rutasPost;
          res.statusCode = conocida ? 405 : 404;
          res.end(JSON.stringify({ ok: false, mensaje: conocida ? "Método no permitido." : "No existe esa ruta de la API." }));
          return;
        }
        res.removeHeader("content-type");
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [apiLocal()],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
