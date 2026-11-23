import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

test(
  "Servidor Node privado, reinicio con datos y bloqueo de escrituras de otro origen",
  { timeout: 15000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "oyp-http-"));
    const pass = crypto.randomUUID();
    const headers = {
      Authorization:
        "Basic " + Buffer.from("consultorio:" + pass).toString("base64"),
      "Content-Type": "application/json",
    };
    let server;
    async function start() {
      server = spawn(process.execPath, ["src/server.js", "--port", "0"], {
        env: {
          ...process.env,
          CRM_PASSWORD: pass,
          CRM_DB: join(dir, "pedidos.sqlite"),
          HOST: "127.0.0.1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const lines = createInterface({ input: server.stdout });
      for await (const line of lines) {
        const match = line.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          lines.close();
          return match[0];
        }
      }
      throw Error("El servidor de prueba no inició.");
    }
    async function stop() {
      if (server && server.exitCode === null && server.signalCode === null) {
        const exited = once(server, "exit");
        server.kill();
        await exited;
      }
    }
    try {
      let url = await start();
      assert.equal((await fetch(url + "/api/datos")).status, 401);
      assert.equal((await fetch(url + "/")).status, 401);
      const payload = {
        clave: crypto.randomUUID(),
        accion: "crear",
        nombre: "Prueba HTTP",
        telefono: "+54 9 2945 123456",
      };
      const write = (origin) =>
        fetch(url + "/api/guardar", {
          method: "POST",
          headers: { ...headers, Origin: origin },
          body: JSON.stringify(payload),
        });
      assert.equal((await write("https://otro.invalid")).status, 403);
      assert.equal((await write(url)).status, 200);
      await stop();
      url = await start();
      assert.equal((await write(url)).status, 200);
      const res = await fetch(url + "/api/datos", { headers });
      const state = await res.json();
      assert.equal(state.orders.length, 1);
      assert.equal(state.orders[0].nombre, "Prueba HTTP");
    } finally {
      await stop();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
