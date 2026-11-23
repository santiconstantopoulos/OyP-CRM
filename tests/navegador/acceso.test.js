import { once } from "node:events";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import worker from "../../dist/server/index.js";
import { openDb } from "../../src/local-db.js";

function localBinding(db) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            sql,
            args,
            first: () => db.one(sql, args),
            all: () => ({ results: db.all(sql, args) }),
          };
        },
      };
    },
    batch(stmts) {
      return db.batch(stmts.map((s) => [s.sql, s.args]));
    },
  };
}

test(
  "Ingresar y cerrar sesión desde los formularios en Chromium a 360 px",
  { timeout: 30000 },
  async (t) => {
    const db = openDb(":memory:");
    t.after(() => db.close());
    const password = crypto.randomUUID(),
      salt = randomBytes(16);
    const env = {
      DB: localBinding(db),
      CRM_PASSWORD_HASH:
        salt.toString("hex") +
        "." +
        pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex"),
    };
    const server = createServer(async (req, res) => {
      try {
        const parts = [];
        for await (const part of req) parts.push(part);
        const url = new URL(req.url, "http://" + req.headers.host);
        const response = await worker.fetch(
          new Request(url, {
            method: req.method,
            headers: req.headers,
            body: parts.length ? Buffer.concat(parts) : undefined,
          }),
          env,
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        res.writeHead(500).end();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => {
      server.closeAllConnections();
      server.close();
    });
    const executablePath =
      process.env.CHROME_BIN ||
      ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
    const browser = await chromium.launch({ executablePath });
    t.after(() => browser.close());
    const page = await browser.newPage({
      viewport: { width: 360, height: 800 },
    });
    const origin = "http://127.0.0.1:" + server.address().port;
    await page.goto(origin);
    await page.getByLabel("Contraseña del consultorio").fill(password);
    const post = (path) =>
      page.waitForResponse(
        (r) => r.url() === origin + path && r.request().method() === "POST",
      );
    const [entry] = await Promise.all([
      post("/ingresar"),
      page.getByRole("button", { name: "Ingresar" }).click(),
    ]);
    assert.equal(
      entry.status(),
      303,
      "El navegador debe poder enviar el formulario de ingreso",
    );
    await page
      .getByRole("heading", { name: "Panel del consultorio" })
      .waitFor();
    await page.reload();
    await page
      .getByRole("heading", { name: "Panel del consultorio" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    const [exit] = await Promise.all([
      post("/salir"),
      page.getByRole("button", { name: "Cerrar sesión" }).click(),
    ]);
    assert.equal(
      exit.status(),
      303,
      "El navegador debe poder cerrar la sesión",
    );
    await page.getByLabel("Contraseña del consultorio").waitFor();
    assert.equal((await page.request.get(origin + "/api/datos")).status(), 401);
  },
);
