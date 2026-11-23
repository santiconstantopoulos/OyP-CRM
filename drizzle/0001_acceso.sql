CREATE TABLE sesion_web (
  token_hash TEXT PRIMARY KEY,
  vence INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX sesion_web_vence ON sesion_web(vence);
--> statement-breakpoint
CREATE TABLE intento_ingreso (
  origen_hash TEXT PRIMARY KEY,
  desde INTEGER NOT NULL,
  cantidad INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX intento_ingreso_desde ON intento_ingreso(desde);
