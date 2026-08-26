import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts:string[]) => readFileSync(resolve(process.cwd(),...parts),"utf8").toLowerCase();
const sql = read("supabase","migrations","20260826180000_clip_variants.sql");

describe("contrato de variantes e revisões",()=>{
  it("aprovação garante exatamente as três variantes de forma idempotente",()=>{
    expect(sql).toContain("unique (clip_id, variant_key)");
    expect(sql).toContain("unnest(array['blur_caption','zoom_caption','zoom_clean']::text[])");
    expect(sql).toContain("on conflict (clip_id, variant_key) do nothing");
  });

  it("cada variante recebe v1 e revisões não sobrescrevem versões",()=>{
    expect(sql).toContain("unique (clip_variant_id, revision_number)");
    expect(sql).toContain("revision_number, parameters");
    expect(sql).toContain("v.id, 1, v.parameters");
  });

  it("pai só fica pronto com 3 de 3 e falha fica isolada na variante atual",()=>{
    expect(sql).toContain("when v_total = 3 and v_ready = 3 then 'ready'");
    expect(sql).toContain("where id = new.clip_variant_id");
    expect(sql).toContain("and current_revision_id = new.id");
  });

  it("assinatura de variante e revisão restringe o proprietário autenticado",()=>{
    const signer=read("supabase","functions","clip-network-sign-media","index.ts");
    expect(signer).toContain('.eq("user_id", user.id)');
    expect(signer).toContain("if (!data || data.user_id !== user.id)");
    expect(signer).toContain("revision_id");
    expect(signer).toContain("variant_id");
  });
});
