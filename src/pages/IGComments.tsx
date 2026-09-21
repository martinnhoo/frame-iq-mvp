import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { igCommentsSupabase } from "@/integrations/supabase/igCommentsClient";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import {
  Check,
  Clipboard,
  Loader2,
  LogOut,
  Plus,
  Save,
  SkipForward,
  Sparkles,
  Trash2,
} from "lucide-react";

type Account = {
  id: string;
  username: string | null;
  display_name: string | null;
  status: string;
};

type Target = {
  id: string;
  user_id: string;
  ad_url: string;
  label: string | null;
  context: string | null;
  status: string;
  created_at: string;
};

type DraftStatus = "draft" | "approved" | "copied" | "skipped";

type Draft = {
  id: string;
  user_id: string;
  target_id: string;
  social_account_id: string | null;
  comment_text: string;
  intent: string;
  status: DraftStatus;
  ai_generated: boolean;
  created_at: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,.16)",
  background: "rgba(2,6,23,.7)",
  color: "#f8fafc",
  padding: "10px 12px",
  outline: "none",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(15,23,42,.72)",
  border: "1px solid rgba(148,163,184,.11)",
  borderRadius: 16,
  padding: 18,
};

const btn: React.CSSProperties = {
  border: 0,
  borderRadius: 9,
  padding: "9px 12px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontWeight: 700,
};

export default function IGComments() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const [adUrl, setAdUrl] = useState("");
  const [label, setLabel] = useState("");
  const [context, setContext] = useState("");
  const [count, setCount] = useState(6);

  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === targetId) ?? null,
    [targets, targetId],
  );

  async function loadAccounts(uid: string) {
    const { data, error } = await igCommentsSupabase
      .from("clip_social_accounts")
      .select("id,username,display_name,status")
      .eq("user_id", uid)
      .eq("platform", "instagram")
      .order("connected_at", { ascending: false });

    if (error) throw error;
    setAccounts((data ?? []) as Account[]);
  }

  async function loadTargets(uid: string) {
    const { data, error } = await igCommentsSupabase
      .from("ig_comment_targets")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as Target[];
    setTargets(rows);

    setTargetId((current) => {
      if (current && rows.some((row) => row.id === current)) return current;
      return rows[0]?.id ?? null;
    });
  }

  async function loadDrafts(uid: string, selectedId: string | null) {
    if (!selectedId) {
      setDrafts([]);
      return;
    }

    setLoadingDrafts(true);

    try {
      const { data, error } = await igCommentsSupabase
        .from("ig_comment_drafts")
        .select("*")
        .eq("user_id", uid)
        .eq("target_id", selectedId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDrafts((data ?? []) as Draft[]);
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function loadWorkspace(uid: string) {
    await Promise.all([loadAccounts(uid), loadTargets(uid)]);
  }

  useEffect(() => {
    let alive = true;

    igCommentsSupabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;

      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        try {
          await loadWorkspace(currentUser.id);
        } catch (error) {
          console.error(error);
          toast.error("Erro ao carregar o IG Comments.");
        }
      }

      if (alive) setBooting(false);
    });

    const {
      data: { subscription },
    } = igCommentsSupabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    loadDrafts(user.id, targetId).catch((error) => {
      console.error(error);
      toast.error("Erro ao carregar os drafts.");
    });
  }, [user, targetId]);


  async function createTarget(event: FormEvent) {
    event.preventDefault();
    if (!user || !adUrl.trim()) return;

    setCreating(true);

    try {
      const { data, error } = await igCommentsSupabase
        .from("ig_comment_targets")
        .insert({
          user_id: user.id,
          ad_url: adUrl.trim(),
          label: label.trim() || null,
          context: context.trim() || null,
          status: "active",
        })
        .select("*")
        .single();

      if (error) throw error;

      const target = data as Target;

      setTargets((current) => [target, ...current]);
      setTargetId(target.id);

      setAdUrl("");
      setLabel("");
      setContext("");

      toast.success("Ad adicionado.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar ad.");
    } finally {
      setCreating(false);
    }
  }

  async function generate() {
    if (!user || !selectedTarget) return;

    setGenerating(true);

    try {
      const accountLabels = accounts.map(
        (account) =>
          account.username || account.display_name || "Instagram account",
      );

      const { data, error } = await igCommentsSupabase.functions.invoke(
        "ig-comments-generate",
        {
          body: {
            ad_url: selectedTarget.ad_url,
            context: selectedTarget.context || "",
            count,
            accounts: accountLabels,
          },
        },
      );

      if (error) throw error;

      const comments = Array.isArray(data?.comments) ? data.comments : [];

      if (!comments.length) {
        throw new Error("A IA não retornou comentários.");
      }

      const rows = comments.map(
        (comment: { text?: string; intent?: string }) => ({
          user_id: user.id,
          target_id: selectedTarget.id,
          social_account_id: null,
          comment_text: String(comment.text || "").trim(),
          intent: ["community", "faq", "support", "reaction", "brand"].includes(
            String(comment.intent),
          )
            ? comment.intent
            : "community",
          status: "draft",
          ai_generated: true,
        }),
      );

      const { error: insertError } = await igCommentsSupabase
        .from("ig_comment_drafts")
        .insert(rows);

      if (insertError) throw insertError;

      await loadDrafts(user.id, selectedTarget.id);
      toast.success(`${rows.length} drafts gerados.`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao gerar comentários.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function localPatch(id: string, patch: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, ...patch } : draft,
      ),
    );
  }

  async function saveDraft(draft: Draft) {
    if (!user) return;

    const { error } = await igCommentsSupabase
      .from("ig_comment_drafts")
      .update({
        comment_text: draft.comment_text,
        social_account_id: draft.social_account_id,
        status: draft.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .eq("user_id", user.id);

    if (error) return toast.error(error.message);

    toast.success("Salvo.");
  }

  async function changeStatus(draft: Draft, status: DraftStatus) {
    if (!user) return;

    const { error } = await igCommentsSupabase
      .from("ig_comment_drafts")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .eq("user_id", user.id);

    if (error) return toast.error(error.message);

    localPatch(draft.id, { status });
  }

  async function copyDraft(draft: Draft) {
    await navigator.clipboard.writeText(draft.comment_text);
    await changeStatus(draft, "copied");
    toast.success("Copiado.");
  }

  async function clearDrafts() {
    if (!user || !selectedTarget) return;
    if (!confirm("Apagar todos os drafts deste ad?")) return;

    const { error } = await igCommentsSupabase
      .from("ig_comment_drafts")
      .delete()
      .eq("user_id", user.id)
      .eq("target_id", selectedTarget.id);

    if (error) return toast.error(error.message);

    setDrafts([]);
  }

  async function deleteTarget() {
    if (!user || !selectedTarget) return;
    if (!confirm("Apagar este ad e seus drafts?")) return;

    const { error } = await igCommentsSupabase
      .from("ig_comment_targets")
      .delete()
      .eq("user_id", user.id)
      .eq("id", selectedTarget.id);

    if (error) return toast.error(error.message);

    const remaining = targets.filter((target) => target.id !== selectedTarget.id);
    setTargets(remaining);
    setTargetId(remaining[0]?.id ?? null);
  }

  async function signOut() {
    await igCommentsSupabase.auth.signOut();
    setUser(null);
    setAccounts([]);
    setTargets([]);
    setDrafts([]);
  }

  if (booting) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#070a0f",
          display: "grid",
          placeItems: "center",
          color: "white",
        }}
      >
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?next=/igcomments" replace />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 15% 0%, rgba(14,165,233,.08), transparent 26%), #070a0f",
        color: "#f8fafc",
      }}
    >
      <div style={{ maxWidth: 1450, margin: "0 auto", padding: 20 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <Logo size="md" />

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>IG Comments</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              AI drafts · review & copy · authorized accounts only
            </div>
          </div>

          <button
            onClick={signOut}
            style={{
              ...btn,
              color: "#cbd5e1",
              background: "rgba(148,163,184,.08)",
            }}
          >
            <LogOut size={14} />
            Sair
          </button>
        </header>

        <div className="ig-layout">
          <aside style={{ display: "grid", alignContent: "start", gap: 14 }}>
            <section style={cardStyle}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                Contas Instagram
              </div>

              {accounts.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  Nenhuma conta Instagram conectada.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 7 }}>
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      style={{
                        borderRadius: 9,
                        background: "rgba(2,6,23,.55)",
                        padding: 9,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12 }}>
                        @{account.username || account.display_name || "instagram"}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 10 }}>
                        {account.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <form onSubmit={createTarget} style={cardStyle}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>
                Novo ad
              </div>

              <div style={{ display: "grid", gap: 9 }}>
                <input
                  style={inputStyle}
                  value={adUrl}
                  onChange={(event) => setAdUrl(event.target.value)}
                  placeholder="URL do anúncio"
                  required
                />

                <input
                  style={inputStyle}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Nome do ad"
                />

                <textarea
                  style={{ ...inputStyle, minHeight: 90 }}
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="Produto, angle, contexto..."
                />

                <button
                  disabled={creating}
                  style={{ ...btn, background: "#0ea5e9", color: "white" }}
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </div>
            </form>

            <section style={cardStyle}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Ads</div>

              <div style={{ display: "grid", gap: 6 }}>
                {targets.map((target) => (
                  <button
                    key={target.id}
                    onClick={() => setTargetId(target.id)}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 9,
                      cursor: "pointer",
                      color: "#e2e8f0",
                      background:
                        target.id === targetId
                          ? "rgba(14,165,233,.12)"
                          : "rgba(2,6,23,.45)",
                      border:
                        target.id === targetId
                          ? "1px solid rgba(14,165,233,.35)"
                          : "1px solid rgba(148,163,184,.08)",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12 }}>
                      {target.label || "Sem nome"}
                    </div>
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: 10,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {target.ad_url}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main style={{ minWidth: 0 }}>
            {!selectedTarget ? (
              <section style={cardStyle}>Selecione ou adicione um anúncio.</section>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <section style={cardStyle}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>
                    {selectedTarget.label || "Ad"}
                  </div>

                  <a
                    href={selectedTarget.ad_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#38bdf8", fontSize: 11 }}
                  >
                    {selectedTarget.ad_url}
                  </a>

                  {selectedTarget.context && (
                    <p style={{ color: "#94a3b8", fontSize: 12 }}>
                      {selectedTarget.context}
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginTop: 15,
                    }}
                  >
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>
                      Drafts
                    </span>

                    <input
                      type="number"
                      min={3}
                      max={12}
                      value={count}
                      onChange={(event) =>
                        setCount(
                          Math.max(
                            3,
                            Math.min(12, Number(event.target.value) || 6),
                          ),
                        )
                      }
                      style={{ ...inputStyle, width: 70 }}
                    />

                    <button
                      onClick={generate}
                      disabled={generating}
                      style={{ ...btn, background: "#8b5cf6", color: "white" }}
                    >
                      {generating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      Gerar
                    </button>

                    <button
                      onClick={clearDrafts}
                      style={{
                        ...btn,
                        color: "#cbd5e1",
                        background: "rgba(148,163,184,.08)",
                      }}
                    >
                      Limpar drafts
                    </button>

                    <button
                      onClick={deleteTarget}
                      style={{
                        ...btn,
                        color: "#fca5a5",
                        background: "rgba(239,68,68,.08)",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </section>

                <section style={cardStyle}>
                  <div style={{ fontWeight: 800, marginBottom: 12 }}>
                    Comentários ({drafts.length})
                  </div>

                  {loadingDrafts ? (
                    <Loader2 className="animate-spin" />
                  ) : drafts.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      Nenhum draft ainda.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {drafts.map((draft) => (
                        <article
                          key={draft.id}
                          style={{
                            background: "rgba(2,6,23,.48)",
                            border: "1px solid rgba(148,163,184,.09)",
                            borderRadius: 11,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 7,
                              marginBottom: 8,
                              color: "#64748b",
                              fontSize: 10,
                              textTransform: "uppercase",
                            }}
                          >
                            <span>{draft.intent}</span>
                            <span>·</span>
                            <span>{draft.status}</span>
                          </div>

                          <textarea
                            style={{
                              ...inputStyle,
                              minHeight: 82,
                              resize: "vertical",
                            }}
                            value={draft.comment_text}
                            onChange={(event) =>
                              localPatch(draft.id, {
                                comment_text: event.target.value,
                              })
                            }
                          />

                          <div
                            style={{
                              display: "flex",
                              gap: 7,
                              flexWrap: "wrap",
                              marginTop: 9,
                            }}
                          >
                            <select
                              style={{ ...inputStyle, width: "auto" }}
                              value={draft.social_account_id || ""}
                              onChange={(event) =>
                                localPatch(draft.id, {
                                  social_account_id: event.target.value || null,
                                })
                              }
                            >
                              <option value="">Sem conta definida</option>

                              {accounts.map((account) => (
                                <option value={account.id} key={account.id}>
                                  @{account.username || account.display_name}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => saveDraft(draft)}
                              style={{
                                ...btn,
                                color: "#cbd5e1",
                                background: "rgba(148,163,184,.08)",
                              }}
                            >
                              <Save size={13} />
                              Salvar
                            </button>

                            <button
                              onClick={() => changeStatus(draft, "approved")}
                              style={{
                                ...btn,
                                color: "#86efac",
                                background: "rgba(34,197,94,.10)",
                              }}
                            >
                              <Check size={13} />
                              Aprovar
                            </button>

                            <button
                              onClick={() => copyDraft(draft)}
                              style={{
                                ...btn,
                                color: "#7dd3fc",
                                background: "rgba(14,165,233,.10)",
                              }}
                            >
                              <Clipboard size={13} />
                              Copiar
                            </button>

                            <button
                              onClick={() => changeStatus(draft, "skipped")}
                              style={{
                                ...btn,
                                color: "#fca5a5",
                                background: "rgba(239,68,68,.07)",
                              }}
                            >
                              <SkipForward size={13} />
                              Pular
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      <style>{`
        .ig-layout {
          display: grid;
          grid-template-columns: 340px minmax(0,1fr);
          gap: 14px;
        }

        @media (max-width: 850px) {
          .ig-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}


