import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../src/local-db.js";
import { api } from "../src/http.js";
import { todayAR, cents } from "../src/service.js";

function desk(t, file = ":memory:") {
  const db = openDb(file);
  t.after(() => db.close());
  const request = (url, method, body) =>
    api(
      new Request("https://consultorio.test/api/" + url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: "https://consultorio.test",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      db,
    );
  const post = async (body) => {
    const res = await request("guardar", "POST", body);
    return { status: res.status, ...(await res.json()) };
  };
  const data = async () => await (await request("datos", "GET")).json();
  const get = async (id) => (await data()).orders.find((p) => p.id === id);
  const create = (extra = {}) =>
    post({
      accion: "crear",
      clave: crypto.randomUUID(),
      nombre: "Ana",
      instagram: "ana_ficticia",
      ...extra,
    });
  const act = async (id, accion, extra = {}) =>
    post({
      id,
      accion,
      version: (await get(id)).version,
      clave: crypto.randomUUID(),
      confirmado: true,
      ...extra,
    });
  const deposit = (id) =>
    act(id, "senar", {
      total: "80.000",
      sena: "30.000",
      detalle: "Un par de plantillas deportivas, talle 40",
    });
  const ready = async (id, full = false) => {
    if (full)
      await act(id, "senar", {
        total: "80000,10",
        sena: "80000,10",
        detalle: "Par talle 40",
      });
    else await deposit(id);
    await act(id, "encargar");
    await act(id, "recibir");
  };
  return { db, post, data, get, create, act, deposit, ready };
}
test("Alta con Instagram solo y reintento de la misma alta", async (t) => {
  const d = desk(t),
    key = crypto.randomUUID();
  const r = await Promise.all([
    d.create({ clave: key }),
    d.create({ clave: key }),
  ]);
  assert.deepEqual(
    r.map((v) => v.status),
    [200, 200],
  );
  const { orders, contacts } = await d.data();
  assert.equal(contacts.length, 1);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].estado, "consulta");
  assert.equal(orders[0].total, null);
  assert.equal(orders[0].detalle, "");
  assert.equal((await d.create({ instagram: "" })).status, 422);
  assert.equal(
    (await d.create({ nombre: "", telefono: "2945123456" })).status,
    422,
  );
});
test("Seña inválida conserva la consulta íntegra", async (t) => {
  const d = desk(t),
    { id } = await d.create();
  for (const [detalle, total, sena] of [
    ["", "80000", "30000"],
    ["Par", "80000", "90000"],
    ["Par", "0", "1"],
    ["Par", "5", "0"],
    ["Par", "2,500", "1"],
    ["Par", "abc", "1"],
  ]) {
    const r = await d.act(id, "senar", { detalle, total, sena });
    assert.equal(r.status, 422);
    assert.ok(r.error);
  }
  const p = await d.get(id);
  assert.equal(p.estado, "consulta");
  assert.equal(p.total, null);
  assert.equal(p.sena, null);
  assert.equal(p.detalle, "");
  assert.equal(p.version, 1);
});
test("Seña, encargo y recepción son hitos separados. Consultar la entrega no la confirma", async (t) => {
  const d = desk(t),
    { id } = await d.create();
  await d.deposit(id);
  let p = await d.get(id);
  assert.equal(p.estado, "senado");
  assert.equal(p.saldo, 5000000);
  assert.ok(p.senado);
  assert.equal((await d.act(id, "recibir")).status, 409);
  assert.equal(
    (await d.act(id, "encargar", { confirmado: false })).status,
    422,
  );
  await d.act(id, "encargar");
  p = await d.get(id);
  assert.equal(p.estado, "encargado");
  assert.ok(p.encargado);
  assert.equal((await d.act(id, "entregar")).status, 409);
  await d.act(id, "recibir");
  const first = await d.get(id);
  assert.ok(first.recibido);
  assert.equal(first.estado, "listo");
  assert.deepEqual(await d.get(id), first);
  assert.equal(first.saldo, 5000000);
  assert.equal(first.final, 0);
});
test("Doble toque, concurrencia y repetición tardía dejan un solo cobro de $50.000", async (t) => {
  const d = desk(t),
    { id } = await d.create();
  await d.ready(id);
  const p = await d.get(id);
  const body = {
    id,
    accion: "entregar",
    clave: crypto.randomUUID(),
    version: p.version,
    confirmado: true,
    final: 99,
  };
  assert.deepEqual(
    (await Promise.all([d.post(body), d.post(body)])).map((v) => v.status),
    [200, 200],
  );
  assert.equal((await d.post(body)).status, 200);
  assert.equal(
    (await d.post({ ...body, clave: crypto.randomUUID() })).status,
    409,
  );
  const after = await d.get(id);
  assert.equal(after.estado, "entregado");
  assert.equal(after.saldo, 0);
  assert.equal(after.final, 5000000);
  assert.equal(after.version, p.version + 1);
  assert.equal(
    d.db.one("SELECT count(*) AS n FROM operacion WHERE tipo='entregar'").n,
    1,
  );
});
test("Una segunda compra conserva la primera ficha y el contacto", async (t) => {
  const d = desk(t),
    { id } = await d.create();
  await d.ready(id);
  await d.act(id, "entregar");
  const first = await d.get(id);
  const other = await d.create({
    contacto_id: first.contacto_id,
    detalle: "Segundo par, talle 41",
  });
  assert.notEqual(other.id, id);
  const s = await d.data();
  assert.equal(s.contacts.length, 1);
  assert.equal(
    s.orders.filter((o) => o.nombre === "Ana" && o.instagram === "ana_ficticia")
      .length,
    2,
  );
  assert.deepEqual(await d.get(id), first);
});
test("Seguimiento vencido y reprogramación mañana con fecha argentina", async (t) => {
  assert.equal(todayAR(new Date("2026-11-24T02:59:59Z")), "2026-11-23");
  assert.equal(todayAR(new Date("2026-11-24T03:00:00Z")), "2026-11-24");
  const d = desk(t),
    { id } = await d.create();
  const past = todayAR(new Date(Date.now() - 86400000)),
    future = todayAR(new Date(Date.now() + 86400000));
  await d.act(id, "seguir", { proxima: "Consultar talle", fecha: past });
  assert.ok((await d.get(id)).fecha < (await d.data()).today);
  await d.act(id, "seguir", { proxima: "Retomar consulta", fecha: future });
  assert.ok((await d.get(id)).fecha > (await d.data()).today);
  assert.equal(
    (await d.act(id, "seguir", { fecha: "2026-02-30" })).status,
    422,
  );
});
test("Seña completa conserva encargo, recepción y entrega sin cobro adicional", async (t) => {
  const d = desk(t),
    { id } = await d.create();
  await d.ready(id, true);
  let p = await d.get(id);
  assert.equal(p.estado, "listo");
  assert.equal(p.saldo, 0);
  await d.act(id, "entregar");
  p = await d.get(id);
  assert.equal(p.estado, "entregado");
  assert.equal(p.final, 0);
  assert.equal(p.sena, 8000010);
  assert.ok(p.entregado);
});
test("Cierre sin venta y control de edición concurrente", async (t) => {
  const d = desk(t),
    { id } = await d.create();
  await d.act(id, "seguir", { fecha: "2026-11-22", proxima: "Llamar" });
  assert.equal(
    (
      await d.post({
        accion: "seguir",
        id,
        clave: crypto.randomUUID(),
        version: 1,
        fecha: "2026-11-25",
      })
    ).status,
    409,
  );
  await d.act(id, "cerrar");
  assert.equal((await d.get(id)).estado, "cerrado");
  assert.equal((await d.deposit(id)).status, 409);
});
test("La base persiste al cerrar y reabrir el servicio", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "oyp-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "crm.sqlite");
  const d = desk(t, file),
    { id } = await d.create();
  await d.deposit(id);
  const other = openDb(file);
  assert.equal(
    other.one("SELECT sena FROM pedido WHERE id=?", [id]).sena,
    3000000,
  );
  other.close();
});
test("Pesos argentinos exactos en centavos, rechaza precisión inválida", () => {
  assert.equal(cents("80.000,25", "total"), 8000025);
  assert.equal(cents("0,01", "total"), 1);
  assert.equal(cents("25.50", "total"), 2550);
  for (const v of ["-2", "12,345", "4e2", "Infinity", "0,00", "9".repeat(20)])
    assert.throws(() => cents(v, "total"));
});
