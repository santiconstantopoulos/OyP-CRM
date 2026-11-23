CREATE TABLE contacto (
 id TEXT PRIMARY KEY, nombre TEXT NOT NULL CHECK(length(trim(nombre)) > 0),
 telefono TEXT NOT NULL DEFAULT '', instagram TEXT NOT NULL DEFAULT '',
 CHECK(telefono <> '' OR instagram <> '')
);
--> statement-breakpoint
CREATE TABLE pedido (
 id TEXT PRIMARY KEY, contacto_id TEXT NOT NULL REFERENCES contacto(id),
 estado TEXT NOT NULL DEFAULT 'consulta' CHECK(estado IN ('consulta','senado','encargado','listo','entregado','cerrado')),
 detalle TEXT NOT NULL DEFAULT '', total INTEGER, sena INTEGER, final INTEGER NOT NULL DEFAULT 0,
 creado TEXT NOT NULL, senado TEXT, encargado TEXT, recibido TEXT, entregado TEXT, cerrado TEXT,
 proxima TEXT NOT NULL DEFAULT '', fecha TEXT, version INTEGER NOT NULL DEFAULT 1, ultima_clave TEXT,
 CHECK((estado IN ('consulta','cerrado') AND total IS NULL AND sena IS NULL AND final=0)
 OR (estado NOT IN ('consulta','cerrado') AND length(trim(detalle))>0 AND total IS NOT NULL AND sena IS NOT NULL AND total>0 AND sena>0 AND sena<=total AND final>=0 AND
 ((estado='entregado' AND final=total-sena) OR (estado<>'entregado' AND final=0))))
);
--> statement-breakpoint
CREATE INDEX idx_pedido_contacto ON pedido(contacto_id);
--> statement-breakpoint
CREATE INDEX idx_pedido_estado_fecha ON pedido(estado,fecha);
--> statement-breakpoint
CREATE TABLE operacion (
 clave TEXT PRIMARY KEY, pedido_id TEXT NOT NULL REFERENCES pedido(id), tipo TEXT NOT NULL, firma TEXT NOT NULL
);
