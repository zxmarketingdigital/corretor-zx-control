// Invariante de núcleo (spec §3/§10): RLS habilitado em TODA tabela + colunas LGPD presentes.
// Teste estático sobre o SQL da migration — roda em CI sem precisar de banco.
import { describe, expect, it } from "vitest";
import migration from "../supabase/migrations/0001_init.sql?raw";

// Tabelas declaradas (extraídas do SQL).
function declaredTables(sql: string): string[] {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/gi;
  return [...sql.matchAll(re)].map((m) => m[1]!.toLowerCase());
}

// Tabelas com RLS habilitado.
function rlsEnabledTables(sql: string): Set<string> {
  const re = /alter\s+table\s+(\w+)\s+enable\s+row\s+level\s+security/gi;
  return new Set([...sql.matchAll(re)].map((m) => m[1]!.toLowerCase()));
}

describe("schema 0001_init", () => {
  it("declara as 6 tabelas do spec §5", () => {
    expect(new Set(declaredTables(migration))).toEqual(
      new Set(["imoveis", "clientes", "conversas", "mensagens", "visitas", "disparos"]),
    );
  });

  it("habilita RLS em TODA tabela (invariante de núcleo, §3)", () => {
    const enabled = rlsEnabledTables(migration);
    for (const table of declaredTables(migration)) {
      expect(enabled, `RLS não habilitado em "${table}"`).toContain(table);
    }
  });

  it("clientes guarda origem + consentimento + opt-out (LGPD, §12)", () => {
    for (const col of ["origem", "consentimento", "opt_out"]) {
      expect(migration, `coluna LGPD "${col}" ausente em clientes`).toMatch(
        new RegExp(`\\b${col}\\b`),
      );
    }
  });

  it("disparos tem as colunas-base de dedup/idempotência/rate-cap (§5/§10)", () => {
    for (const col of ["chave_idempotencia", "numero", "imovel_id", "agente"]) {
      expect(migration, `coluna "${col}" ausente em disparos`).toMatch(
        new RegExp(`\\b${col}\\b`),
      );
    }
  });
});
