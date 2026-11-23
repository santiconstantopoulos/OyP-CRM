import { save, todayAR } from "./service.js";
export async function seed(db) {
  if (await db.one("SELECT id FROM pedido LIMIT 1")) return;
  const examples = [
    ["Ana Ríos", "Plantillas deportivas · Talle 40", "senado", 80000, 30000],
    [
      "Mateo García",
      "Plantillas de uso diario · Talle 42",
      "senado",
      72000,
      25000,
    ],
    ["Julia Méndez", "Plantillas Running · Talle 38", "listo", 85000, 35000],
    ["Lucas Vidal", "Plantillas de confort · Talle 43", "listo", 70000, 30000],
    ["Clara Torres", "Plantillas para caminar", "consulta"],
    ["Nicolás Luna", "Plantillas para correr", "consulta"],
    ["Sofía Vega", "Plantillas a medida · Talle 37", "encargado", 70000, 20000],
  ];
  for (const [nombre, detalle, estado, total, sena] of examples) {
    const { id } = await save(db, {
      accion: "crear",
      clave: crypto.randomUUID(),
      nombre,
      instagram: "ejemplo_" + String(crypto.randomUUID()).slice(0, 8),
      detalle,
    });
    let version = 1;
    const act = (accion, fields = {}) =>
      save(db, {
        clave: crypto.randomUUID(),
        id,
        version: version++,
        accion,
        confirmado: true,
        ...fields,
      });
    if (estado === "consulta") {
      await act("seguir", {
        proxima: nombre.startsWith("Clara")
          ? "Confirmar el talle por WhatsApp"
          : "Consultar si pudo ver el presupuesto",
        fecha: todayAR(
          new Date(Date.now() - (nombre.startsWith("Clara") ? 86400000 : 0)),
        ),
      });
      continue;
    }
    await act("senar", { detalle, total: String(total), sena: String(sena) });
    if (estado !== "senado") await act("encargar");
    if (estado === "listo") await act("recibir");
  }
}
