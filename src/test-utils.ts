import schemaSql from "../schema.sql?raw"

export async function applySchema(db: D1Database) {
  const statements = schemaSql
    .split(";")
    .map((s: string) => s.trim())
    .filter(Boolean)
  for (const sql of statements) {
    await db.prepare(sql).run()
  }
}
