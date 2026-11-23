const cookieName = "__Host-oyp_sesion";
const sessionSeconds = 12 * 60 * 60;
const attemptWindow = 10 * 60;
const encoder = new TextEncoder();
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};
const loginDestinations = new Set([
  "/",
  "/prototipo",
  "/guia",
  "/proyecto.zip",
]);
const destination = (path) => (loginDestinations.has(path) ? path : "/");
const toHex = (bytes) =>
  Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
const fromHex = (hex) =>
  Uint8Array.from(hex.match(/../g), (pair) => parseInt(pair, 16));
const digest = async (value) =>
  toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));

async function matchesPassword(password, record) {
  const [salt, expected] = record.split(".");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: fromHex(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
  const wanted = fromHex(expected);
  let difference = 0;
  for (let i = 0; i < wanted.length; i++) difference |= wanted[i] ^ actual[i];
  return difference === 0;
}

function loginPage(path, message = "", status = 200, headers = {}) {
  const html = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#123e3d"><title>Ingresar · OyP Esquel</title><link rel="icon" href="/oyp.png"><link rel="stylesheet" href="/estilos.css"></head><body class="login-body"><main class="login-card"><img src="/oyp.png" alt="O&P Plantillas Biodinámicas"><h1>Consultorio Esquel</h1><form class="form" method="post" action="/ingresar"><input type="hidden" name="destino" value="${destination(path)}"><label for="password">Contraseña del consultorio</label><input id="password" name="password" type="password" required maxlength="180" autocomplete="current-password">${message ? '<p class="error" role="alert">' + message + "</p>" : ""}<button class="btn primary" type="submit">Ingresar</button></form></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      ...privateHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; style-src 'self'; form-action 'self'; base-uri 'none'",
      ...headers,
    },
  });
}
function cookie(value, age) {
  return (
    cookieName +
    "=" +
    value +
    "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=" +
    age
  );
}
function redirect(path, sessionCookie) {
  return new Response(null, {
    status: 303,
    headers: {
      ...privateHeaders,
      Location: path,
      ...(sessionCookie ? { "Set-Cookie": sessionCookie } : {}),
    },
  });
}
function getToken(request) {
  const part = (request.headers.get("Cookie") || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="));
  const token = part?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function sameOrigin(request, url) {
  return (
    request.headers.get("Origin") === url.origin &&
    request.headers.get("Sec-Fetch-Site") !== "cross-site"
  );
}

// A null response grants access. The database stores only digests of session tokens.
export async function guardAccess(request, db, record) {
  const url = new URL(request.url),
    path = url.pathname;
  if (request.method === "GET" && ["/oyp.png", "/estilos.css"].includes(path))
    return null;
  if (!/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(record || "")) {
    return new Response(
      "El ingreso al consultorio todavía no está configurado.",
      { status: 503, headers: privateHeaders },
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const token = getToken(request);
  const tokenHash = token ? await digest(record + ":" + token) : null;
  if (path === "/salir") {
    if (request.method !== "POST" || !sameOrigin(request, url))
      return new Response(null, { status: 403, headers: privateHeaders });
    if (tokenHash)
      await db.batch([
        ["DELETE FROM sesion_web WHERE token_hash=?", [tokenHash]],
      ]);
    return redirect("/", cookie("", 0));
  }
  if (path === "/ingresar" && request.method === "POST") {
    if (!sameOrigin(request, url))
      return new Response(null, { status: 403, headers: privateHeaders });
    if (
      !request.headers
        .get("Content-Type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return new Response(null, { status: 415, headers: privateHeaders });
    if (Number(request.headers.get("Content-Length")) > 2048)
      return new Response(null, { status: 413, headers: privateHeaders });
    const formText = await request.text();
    if (formText.length > 2048)
      return new Response(null, { status: 413, headers: privateHeaders });
    const form = new URLSearchParams(formText),
      dest = destination(form.get("destino")),
      password = form.get("password") || "";
    if (!password || password.length > 180)
      return loginPage(dest, "Ingresá la contraseña del consultorio.", 400);
    const origen = await digest(
      record +
        ":origen:" +
        (request.headers.get("CF-Connecting-IP") || "compartido"),
    );
    const count = await db.one(
      `INSERT INTO intento_ingreso(origen_hash,desde,cantidad) VALUES(?,?,1)
      ON CONFLICT(origen_hash) DO UPDATE SET
        cantidad=CASE WHEN intento_ingreso.desde<=excluded.desde-? THEN 1 ELSE intento_ingreso.cantidad+1 END,
        desde=CASE WHEN intento_ingreso.desde<=excluded.desde-? THEN excluded.desde ELSE intento_ingreso.desde END
      RETURNING cantidad,desde`,
      [origen, now, attemptWindow, attemptWindow],
    );
    if (count.cantidad > 10)
      return loginPage(
        dest,
        "Hubo varios intentos. Volvé a probar en unos minutos.",
        429,
        {
          "Retry-After": String(Math.max(1, count.desde + attemptWindow - now)),
        },
      );
    if (!(await matchesPassword(password, record)))
      return loginPage(dest, "La contraseña es incorrecta.", 401);
    const fresh = toHex(crypto.getRandomValues(new Uint8Array(32)));
    await db.batch([
      [
        "DELETE FROM sesion_web WHERE vence<=? OR token_hash=?",
        [now, tokenHash],
      ],
      [
        "DELETE FROM intento_ingreso WHERE origen_hash=? OR desde<=?",
        [origen, now - attemptWindow],
      ],
      [
        "INSERT INTO sesion_web(token_hash,vence) VALUES(?,?)",
        [await digest(record + ":" + fresh), now + sessionSeconds],
      ],
    ]);
    return redirect(dest, cookie(fresh, sessionSeconds));
  }
  if (
    tokenHash &&
    (await db.one("SELECT 1 FROM sesion_web WHERE token_hash=? AND vence>?", [
      tokenHash,
      now,
    ]))
  ) {
    return path === "/ingresar" ? redirect("/") : null;
  }
  if (path.startsWith("/api/"))
    return Response.json(
      {
        error: "Ingresá con la contraseña del consultorio.",
        ingresar: "/ingresar",
      },
      { status: 401, headers: privateHeaders },
    );
  if (
    request.method === "GET" &&
    (path === "/ingresar" || loginDestinations.has(path))
  )
    return loginPage(path);
  return new Response(null, { status: 401, headers: privateHeaders });
}
