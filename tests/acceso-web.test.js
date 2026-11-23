import test from "node:test";
import assert from "node:assert/strict";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { openDb } from "../src/local-db.js";
import { guardAccess } from "../src/acceso.js";
import { api } from "../src/http.js";

const origin = "https://consultorio.test";
const pass = crypto.randomUUID();
const salt = randomBytes(16);
const verifier =
  salt.toString("hex") +
  "." +
  pbkdf2Sync(pass, salt, 100000, 32, "sha256").toString("hex");
function login(body, extra = {}) {
  return new Request(origin + "/ingresar", {
    method: "POST",
    headers: { Origin: origin, ...extra },
    body: new URLSearchParams(body),
  });
}
function request(path, session = "", method = "GET", body) {
  return new Request(origin + path, {
    method,
    headers: {
      Cookie: session,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("Acceso web con clave: lectura, escritura, vencimiento, rotación y cierre", async (t) => {
  const db = openDb(":memory:");
  t.after(() => db.close());
  const handle = async (req, record = verifier) =>
    (await guardAccess(req, db, record)) ?? (await api(req, db));
  const page = await handle(request("/"));
  assert.match(await page.text(), /Contraseña del consultorio/);
  assert.equal((await handle(request("/api/datos"))).status, 401);
  assert.equal(
    (await handle(request("/api/guardar", "", "POST", {}))).status,
    401,
  );
  assert.equal((await handle(request("/api/datos"), "")).status, 503);
  assert.equal((await handle(login({ password: "incorrecta" }))).status, 401);
  assert.equal(
    (
      await handle(
        login({ password: pass }, { Origin: "https://externo.test" }),
      )
    ).status,
    403,
  );
  const first = await handle(login({ password: pass, destino: "/prototipo" }));
  assert.equal(first.status, 303);
  assert.equal(first.headers.get("location"), "/prototipo");
  const raw = first.headers.get("set-cookie");
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    assert.ok(raw.includes(flag));
  const session = raw.split(";")[0];
  assert.equal((await handle(request("/api/datos", session))).status, 200);
  const order = await handle(
    request("/api/guardar", session, "POST", {
      clave: crypto.randomUUID(),
      accion: "crear",
      nombre: "Prueba ficticia",
      instagram: "ejemplo_ficticio",
    }),
  );
  assert.equal(order.status, 200);
  const second = await handle(
    login({ password: pass, destino: "https://externo.test" }),
  );
  assert.equal(second.headers.get("location"), "/");
  const other = second.headers.get("set-cookie").split(";")[0];
  assert.notEqual(session, other);
  const logout = await handle(request("/salir", session, "POST"));
  assert.equal(logout.status, 303);
  assert.equal((await handle(request("/api/datos", session))).status, 401);
  assert.equal((await handle(request("/api/datos", other))).status, 200);
  const replacement =
    randomBytes(16).toString("hex") + "." + randomBytes(32).toString("hex");
  assert.equal(
    (await handle(request("/api/datos", other), replacement)).status,
    401,
  );
  db.batch([["UPDATE sesion_web SET vence=0", []]]);
  assert.equal((await handle(request("/api/datos", other))).status, 401);
});
test("El ingreso limita intentos consecutivos y permite volver después de la espera", async (t) => {
  const db = openDb(":memory:");
  t.after(() => db.close());
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await guardAccess(login({ password: "incorrecta" }), db, verifier))
        .status,
      401,
    );
  const blocked = await guardAccess(login({ password: pass }), db, verifier);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
  db.batch([["UPDATE intento_ingreso SET desde=0", []]]);
  assert.equal(
    (await guardAccess(login({ password: pass }), db, verifier)).status,
    303,
  );
});
