import {
  readFile,
  writeFile,
  mkdir,
  cp,
  mkdtemp,
  rm,
  readdir,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { deflateRawSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ZIP portable, construido únicamente a partir de los directorios del proyecto.
function zip(files) {
  let offset = 0;
  const local = [],
    central = [];
  for (const [path, bytes] of files) {
    const name = Buffer.from("oyp-consultorio/" + path),
      packed = deflateRawSync(bytes);
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let k = 0; k < 8; k++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(8, 8);
    head.writeUInt16LE(33, 12);
    head.writeUInt32LE((crc ^ -1) >>> 0, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(bytes.length, 22);
    head.writeUInt16LE(name.length, 26);
    const idx = Buffer.alloc(46);
    idx.writeUInt32LE(0x02014b50);
    idx.writeUInt16LE(20, 4);
    head.copy(idx, 6, 4, 30);
    idx.writeUInt32LE(offset, 42);
    local.push(head, name, packed);
    central.push(idx, name);
    offset += head.length + name.length + packed.length;
  }
  const dir = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, dir, end]);
}
const dist = "dist";
await mkdir(dist + "/server", { recursive: true });
await mkdir(dist + "/.openai", { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "oyp-build-"));
try {
  const demoFile = join(temp, "demo.html");
  execFileSync(process.execPath, ["scripts/prototype.js", demoFile]);
  const files = [
    "README.md",
    "package.json",
    "package-lock.json",
    ".env.example",
    ".gitignore",
    ".openai/hosting.json",
  ];
  for (const dir of ["src", "scripts", "public", "drizzle", "tests"]) {
    for (const file of await readdir(dir, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (file.isFile())
        files.push(join(file.parentPath, file.name).replaceAll("\\", "/"));
    }
  }
  const sources = await Promise.all(
    files.sort().map(async (path) => [path, await readFile(path)]),
  );
  const sourceZip = zip(sources);
  const assets = {};
  const add = (path, type, bytes, binary = false, filename) => {
    assets[path] = {
      type,
      data: bytes.toString(binary ? "base64" : "utf8"),
      binary,
      filename,
    };
  };
  for (const [path, name, type, binary] of [
    ["/", "index.html", "text/html; charset=utf-8"],
    ["/app.js", "app.js", "text/javascript; charset=utf-8"],
    ["/estilos.css", "estilos.css", "text/css; charset=utf-8"],
    ["/oyp.png", "oyp.png", "image/png", true],
    ["/plantillas.webp", "plantillas.webp", "image/webp", true],
  ])
    add(path, type, await readFile("public/" + name), binary);
  add("/prototipo", "text/html; charset=utf-8", await readFile(demoFile));
  add(
    "/proyecto.zip",
    "application/zip",
    sourceZip,
    true,
    "OyP-Consultorio-Node.zip",
  );
  add("/guia", "text/plain; charset=utf-8", await readFile("README.md"));
  // El Worker se entrega como un único módulo, sin dependencias externas.
  const moduleText = async (name) =>
    (await readFile("src/" + name, "utf8"))
      .replace(/^import [^;]+;\s*$/gm, "")
      .replace(/^export (?=(class|function|async |const ))/gm, "");
  const code =
    (await moduleText("service.js")) +
    "\n" +
    (await moduleText("http.js")) +
    "\nconst assets=" +
    JSON.stringify(assets) +
    ";\n" +
    (await moduleText("worker.js"));
  await writeFile(dist + "/server/index.js", code);
  await cp(".openai/hosting.json", dist + "/.openai/hosting.json");
  await cp("drizzle", dist + "/drizzle", { recursive: true });
  await writeFile(join(temp, "check.mjs"), code);
  execFileSync(process.execPath, ["--check", join(temp, "check.mjs")]);
  console.log("Worker, migración y descargas verificados.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
