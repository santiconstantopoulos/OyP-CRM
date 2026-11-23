import { openDb } from "../src/local-db.js";
const file = process.env.CRM_DB || "data/consultorio.sqlite";
openDb(file).close();
console.log("Base del consultorio lista en " + file);
