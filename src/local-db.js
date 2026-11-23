import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
export function openDb(file) {
  if (file !== ":memory:")
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000",
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    const version = db.prepare("PRAGMA user_version").get().user_version;
    const migrations = ["0000_consultorio.sql", "0001_acceso.sql"];
    for (let index = version; index < migrations.length; index++) {
      const path = new URL("../drizzle/" + migrations[index], import.meta.url);
      db.exec(readFileSync(path, "utf8"));
      db.exec("PRAGMA user_version=" + (index + 1));
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return {
    all: (sql, args = []) => db.prepare(sql).all(...args),
    one: (sql, args = []) => db.prepare(sql).get(...args),
    batch(stmts) {
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const [sql, args] of stmts) db.prepare(sql).run(...args);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => db.close(),
  };
}
