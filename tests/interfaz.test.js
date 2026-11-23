import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setTimeout as pause } from "node:timers/promises";
import { Window } from "happy-dom";
import { openDb } from "../src/local-db.js";
import { seed } from "../src/seed.js";
import { api } from "../src/http.js";
const html = readFileSync(
  new URL("../public/index.html", import.meta.url),
  "utf8",
);
const script = readFileSync(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);

async function eventually(condition) {
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    if (condition()) return;
    await pause(10);
  }
  assert.ok(condition(), "No se actualizó la pantalla esperada.");
}
test("Pantallas, reintento tras respuesta perdida, recompra, búsqueda y seguimiento", async (t) => {
  const db = openDb(":memory:");
  await seed(db);
  t.after(() => db.close());
  const win = new Window({
    url: "https://consultorio.test/",
    width: 360,
    height: 800,
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  t.after(() => win.happyDOM.abort());
  const doc = win.document;
  doc.body.innerHTML = html.split("<body>")[1].split("</body>")[0];
  let nextResponseLost = false;
  win.fetch = async (path, init) => {
    const res = await api(
      new Request(new URL(path, win.location.href), init),
      db,
    );
    if (nextResponseLost && init.method === "POST") {
      nextResponseLost = false;
      throw new TypeError("corte simulado");
    }
    return res;
  };
  win.eval(script);
  const title = () => doc.querySelector("h1")?.textContent,
    text = () => doc.querySelector("main").textContent;
  const route = async (hash, predicate) => {
    win.location.hash = hash;
    await eventually(predicate);
  };
  const field = (name, v) => {
    doc.querySelector('[name="' + name + '"]').value = v;
  };
  const submit = (sel) =>
    doc
      .querySelector(sel)
      .dispatchEvent(
        new win.Event("submit", { bubbles: true, cancelable: true }),
      );
  await eventually(() => title() === "Panel del consultorio");
  assert.match(text(), /Por pedir al proveedor/);
  assert.match(text(), /Por entregar y cobrar/);
  assert.match(text(), /Vencido/);
  await route("#/nueva", () => !!doc.querySelector("#new-form"));
  field("nombre", "Ana Prueba");
  field("instagram", "ana_prueba_ficticia");
  nextResponseLost = true;
  submit("#new-form");
  await eventually(() =>
    doc.querySelector(".error")?.textContent.includes("conexión"),
  );
  assert.equal(doc.querySelector("[name=nombre]").value, "Ana Prueba");
  submit("#new-form");
  await eventually(() => title() === "Ana Prueba");
  const id = win.location.hash.split("/").pop();
  assert.equal(
    db.one("SELECT count(*) AS n FROM contacto WHERE nombre='Ana Prueba'").n,
    1,
  );
  field("detalle", "Un par talle 40");
  field("total", "80000");
  field("sena", "90000");
  submit("#advance");
  await eventually(() => text().includes("no puede superar"));
  assert.equal(doc.querySelector("[name=sena]").value, "90000");
  field("sena", "30000");
  submit("#advance");
  await eventually(
    () =>
      doc.querySelector("#advance h2")?.textContent === "Encargo al proveedor",
  );
  assert.match(text(), /50\.000/);
  submit("#advance");
  await eventually(() => text().includes("Marcar como recibido"));
  submit("#advance");
  await eventually(() => text().includes("Confirmar entrega y cobro"));
  await route("#/", () => title() === "Panel del consultorio");
  const delivery = Array.from(doc.querySelectorAll(".panel")).find((p) =>
    p.textContent.includes("Por entregar y cobrar"),
  );
  assert.match(delivery.textContent, /Ana Prueba/);
  await route("#/ficha/" + id, () => title() === "Ana Prueba");
  submit("#advance");
  submit("#advance");
  await eventually(() => text().includes("Entregado y cobrado"));
  assert.equal(
    db.one("SELECT final FROM pedido WHERE id=?", [id]).final,
    5000000,
  );
  doc.querySelector('a[href^="#/nueva/"]').click();
  await eventually(() => !!doc.querySelector("#new-form"));
  assert.match(doc.querySelector("#chosen").textContent, /Ana Prueba/);
  submit("#new-form");
  await eventually(
    () => title() === "Ana Prueba" && win.location.hash !== "#/ficha/" + id,
  );
  const nextId = win.location.hash.split("/").pop();
  field("proxima", "Volver a consultar");
  field("fecha", "2000-01-01");
  submit("#follow");
  await eventually(
    () =>
      db.one("SELECT fecha FROM pedido WHERE id=?", [nextId]).fecha ===
      "2000-01-01",
  );
  await route("#/", () => title() === "Panel del consultorio");
  assert.match(doc.querySelector(".followrow").textContent, /Ana Prueba/);
  await route("#/ficha/" + nextId, () => title() === "Ana Prueba");
  field("fecha", "2099-01-01");
  submit("#follow");
  await eventually(
    () =>
      db.one("SELECT fecha FROM pedido WHERE id=?", [nextId]).fecha ===
      "2099-01-01",
  );
  await route("#/", () => title() === "Panel del consultorio");
  assert.ok(
    !Array.from(doc.querySelectorAll(".followrow")).some((x) =>
      x.textContent.includes("Ana Prueba"),
    ),
  );
  await route("#/buscar", () => !!doc.querySelector("#query"));
  const query = doc.querySelector("#query");
  query.value = "@ana_prueba_ficticia";
  query.dispatchEvent(new win.Event("input"));
  assert.equal(doc.querySelectorAll("#matches .row").length, 2);
  assert.match(
    doc.querySelector("#matches").textContent,
    /Entregado y cobrado/,
  );
});
