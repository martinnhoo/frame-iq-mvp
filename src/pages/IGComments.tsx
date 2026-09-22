import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { igCommentsSupabase } from "@/integrations/supabase/igCommentsClient";
import type { Database } from "@/integrations/supabase/types";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

type Account = {
  id: string;
  username: string | null;
  display_name: string | null;
  status: string;
};

type AccountProfile = {
  social_account_id: string | null;
  tone: string | null;
};

type Target = Database["public"]["Tables"]["ig_comment_targets"]["Row"];

type AssignmentStatus =
  | "selected"
  | "generated"
  | "approved"
  | "rejected"
  | "queued"
  | "posted"
  | "failed";

type Assignment = {
  id: string;
  user_id: string;
  target_id: string;
  social_account_id: string;
  selected: boolean;
  status: AssignmentStatus;
};

type ReviewStatus = "pending" | "approved" | "rejected";
type DraftStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "queued"
  | "publishing"
  | "published"
  | "failed"
  | "copied"
  | "skipped";

type Draft = {
  id: string;
  user_id: string;
  target_id: string;
  assignment_id: string | null;
  social_account_id: string | null;
  comment_text: string;
  intent: string;
  status: DraftStatus;
  review_status: ReviewStatus;
  ai_generated: boolean;
  reviewed_at: string | null;
  queued_at: string | null;
  posted_at: string | null;
  provider_comment_id: string | null;
  failure_reason: string | null;
  created_at: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 42,
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,.16)",
  background: "rgba(2,6,23,.72)",
  color: "#f8fafc",
  padding: "9px 11px",
  outline: "none",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(15,23,42,.72)",
  border: "1px solid rgba(148,163,184,.11)",
  borderRadius: 16,
  padding: 16,
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

function accountLabel(account: Account) {
  return account.username || account.display_name || "instagram";
}

export default function IGComments() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountProfiles, setAccountProfiles] = useState<AccountProfile[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

  const [adUrl, setAdUrl] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [inspectingTargetId, setInspectingTargetId] = useState<string | null>(null);
  const [savingSelection, setSavingSelection] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [queueing, setQueueing] = useState(false);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === targetId) ?? null,
    [targets, targetId],
  );

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const toneByAccountId = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of accountProfiles) {
      if (profile.social_account_id && profile.tone) map.set(profile.social_account_id, profile.tone);
    }
    return map;
  }, [accountProfiles]);

  const reviewCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let queued = 0;
    let published = 0;
    let failed = 0;

    for (const draft of drafts) {
      if (draft.review_status === "pending") pending += 1;
      if (draft.review_status === "approved") approved += 1;
      if (draft.review_status === "rejected") rejected += 1;
      if (draft.status === "queued") queued += 1;
      if (draft.status === "published") published += 1;
      if (draft.status === "failed") failed += 1;
    }

    return { pending, approved, rejected, queued, published, failed };
  }, [drafts]);

  async function loadAccounts(uid: string) {
    const { data: accountRows, error: accountsError } = await igCommentsSupabase
      .from("clip_social_accounts")
      .select("id,username,display_name,status")
      .eq("user_id", uid)
      .eq("platform", "instagram")
      .order("connected_at", { ascending: false });

    if (accountsError) throw accountsError;

    // Connected accounts are the primary source. A secondary profile/tone
    // failure must never hide an actually connected Instagram account.
    setAccounts((accountRows ?? []) as Account[]);

    const { data: profileRows, error: profilesError } = await igCommentsSupabase
      .from("ig_comment_accounts")
      .select("social_account_id,tone")
      .eq("user_id", uid);

    if (profilesError) {
      console.warn("[IGComments] account profiles:", profilesError);
      setAccountProfiles([]);
      return;
    }

    setAccountProfiles((profileRows ?? []) as AccountProfile[]);
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

  async function loadTargetWorkspace(uid: string, selectedId: string | null) {
    if (!selectedId) {
      setAssignments([]);
      setDrafts([]);
      setSelectedAccountIds(new Set());
      return;
    }

    setWorkspaceLoading(true);
    try {
      const [{ data: assignmentRows, error: assignmentError }, { data: draftRows, error: draftError }] =
        await Promise.all([
          igCommentsSupabase
            .from("ig_comment_target_accounts")
            .select("id,user_id,target_id,social_account_id,selected,status")
            .eq("user_id", uid)
            .eq("target_id", selectedId)
            .order("created_at", { ascending: true }),
          igCommentsSupabase
            .from("ig_comment_drafts")
            .select("*")
            .eq("user_id", uid)
            .eq("target_id", selectedId)
            .order("created_at", { ascending: true }),
        ]);

      if (assignmentError) throw assignmentError;
      if (draftError) throw draftError;

      const nextAssignments = (assignmentRows ?? []) as Assignment[];
      setAssignments(nextAssignments);
      setSelectedAccountIds(
        new Set(nextAssignments.filter((row) => row.selected).map((row) => row.social_account_id)),
      );
      setDrafts((draftRows ?? []) as Draft[]);
    } finally {
      setWorkspaceLoading(false);
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
    loadTargetWorkspace(user.id, targetId).catch((error) => {
      console.error(error);
      toast.error("Erro ao carregar a publicação.");
    });
  }, [user, targetId]);

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function selectAllAccounts() {
    setSelectedAccountIds(new Set(accounts.filter((a) => a.status === "active").map((a) => a.id)));
  }

  function clearSelectedAccounts() {
    setSelectedAccountIds(new Set());
  }

  async function persistSelection(): Promise<Assignment[]> {
    if (!user || !selectedTarget) return [];

    const selectedIds = Array.from(selectedAccountIds);
    const existingByAccount = new Map(assignments.map((row) => [row.social_account_id, row]));

    const rowsToUpsert = selectedIds.map((socialAccountId) => ({
      user_id: user.id,
      target_id: selectedTarget.id,
      social_account_id: socialAccountId,
      selected: true,
      status: (existingByAccount.get(socialAccountId)?.status || "selected") as AssignmentStatus,
      updated_at: new Date().toISOString(),
    }));

    if (rowsToUpsert.length) {
      const { error } = await igCommentsSupabase
        .from("ig_comment_target_accounts")
        .upsert(rowsToUpsert, { onConflict: "target_id,social_account_id" });
      if (error) throw error;
    }

    const deselectedIds = assignments
      .filter((row) => row.selected && !selectedAccountIds.has(row.social_account_id))
      .map((row) => row.id);

    if (deselectedIds.length) {
      const { error } = await igCommentsSupabase
        .from("ig_comment_target_accounts")
        .update({ selected: false, updated_at: new Date().toISOString() })
        .in("id", deselectedIds)
        .eq("user_id", user.id);
      if (error) throw error;
    }

    const { data, error } = await igCommentsSupabase
      .from("ig_comment_target_accounts")
      .select("id,user_id,target_id,social_account_id,selected,status")
      .eq("user_id", user.id)
      .eq("target_id", selectedTarget.id)
      .eq("selected", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const next = (data ?? []) as Assignment[];
    setAssignments((current) => {
      const inactive = current.filter((row) => !next.some((n) => n.id === row.id));
      return [...inactive, ...next];
    });
    return next;
  }

  async function saveSelection() {
    if (!user || !selectedTarget) return;
    setSavingSelection(true);
    try {
      const saved = await persistSelection();
      toast.success(`${saved.length} conta${saved.length === 1 ? "" : "s"} selecionada${saved.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao salvar seleção.");
    } finally {
      setSavingSelection(false);
    }
  }

  async function inspectTarget(target: Target): Promise<Target> {
    setInspectingTargetId(target.id);
    try {
      const { data, error } = await igCommentsSupabase.functions.invoke("ig-comments-inspect", {
        body: { target_id: target.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data?.message || data.error);

      const updated = data?.target as Target | undefined;
      if (!updated) throw new Error("A análise da publicação não retornou dados.");

      setTargets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );

      return updated;
    } finally {
      setInspectingTargetId((current) => (current === target.id ? null : current));
    }
  }

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
          context: null,
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
      setSelectedAccountIds(new Set());

      try {
        await inspectTarget(target);
        toast.success("Publicação adicionada e analisada.");
      } catch (inspectionError) {
        console.error(inspectionError);
        toast.error(
          inspectionError instanceof Error
            ? inspectionError.message
            : "Publicação adicionada, mas o link não pôde ser analisado.",
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar publicação.");
    } finally {
      setCreating(false);
    }
  }

  async function generateForSelectedAccounts() {
    if (!user || !selectedTarget) return;
    if (selectedAccountIds.size === 0) {
      toast.error("Selecione pelo menos uma conta.");
      return;
    }

    setGenerating(true);
    try {
      const readyTarget =
        selectedTarget.inspection_status === "ready"
          ? selectedTarget
          : await inspectTarget(selectedTarget);

      if (readyTarget.inspection_status !== "ready") {
        throw new Error("Não consegui analisar esta publicação pelo link.");
      }

      const activeAssignments = await persistSelection();
      if (!activeAssignments.length) throw new Error("Nenhuma conta selecionada.");

      const assignmentPayload = activeAssignments
        .map((assignment) => {
          const account = accountById.get(assignment.social_account_id);
          if (!account) return null;
          return {
            social_account_id: account.id,
            username: account.username || "",
            display_name: account.display_name || "",
            tone: toneByAccountId.get(account.id) || "",
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      const { data, error } = await igCommentsSupabase.functions.invoke("ig-comments-generate", {
        body: {
          target_id: readyTarget.id,
          assignments: assignmentPayload,
        },
      });

      if (error) throw error;

      const comments = Array.isArray(data?.comments) ? data.comments : [];
      if (!comments.length) throw new Error("A IA não retornou comentários.");

      const assignmentByAccount = new Map(
        activeAssignments.map((assignment) => [assignment.social_account_id, assignment]),
      );

      const rows = comments
        .map((comment: { social_account_id?: string; text?: string; intent?: string }) => {
          const socialAccountId = String(comment.social_account_id || "");
          const assignment = assignmentByAccount.get(socialAccountId);
          const text = String(comment.text || "").trim();
          if (!assignment || !text) return null;

          return {
            user_id: user.id,
            target_id: readyTarget.id,
            assignment_id: assignment.id,
            social_account_id: socialAccountId,
            comment_text: text,
            intent: ["community", "faq", "support", "reaction", "brand"].includes(
              String(comment.intent),
            )
              ? String(comment.intent)
              : "community",
            status: "draft",
            review_status: "pending",
            reviewed_at: null,
            queued_at: null,
            posted_at: null,
            provider_comment_id: null,
            failure_reason: null,
            ai_generated: true,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      if (!rows.length) throw new Error("Nenhum comentário pôde ser associado às contas.");

      const { error: draftError } = await igCommentsSupabase
        .from("ig_comment_drafts")
        .upsert(rows, { onConflict: "assignment_id" });
      if (draftError) throw draftError;

      const generatedAssignmentIds = activeAssignments
        .filter((assignment) => rows.some((row) => row?.assignment_id === assignment.id))
        .map((assignment) => assignment.id);

      if (generatedAssignmentIds.length) {
        const { error: assignmentError } = await igCommentsSupabase
          .from("ig_comment_target_accounts")
          .update({ status: "generated", updated_at: new Date().toISOString() })
          .in("id", generatedAssignmentIds)
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
      }

      await loadTargetWorkspace(user.id, readyTarget.id);
      const missingCount = Array.isArray(data?.missing) ? data.missing.length : 0;
      toast.success(
        `${rows.length} comentário${rows.length === 1 ? "" : "s"} gerado${rows.length === 1 ? "" : "s"}${
          missingCount ? ` · ${missingCount} conta(s) sem resposta` : ""
        }.` ,
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar comentários.");
    } finally {
      setGenerating(false);
    }
  }

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  async function saveDraft(draft: Draft) {
    if (!user) return;
    const { error } = await igCommentsSupabase
      .from("ig_comment_drafts")
      .update({ comment_text: draft.comment_text, updated_at: new Date().toISOString() })
      .eq("id", draft.id)
      .eq("user_id", user.id);

    if (error) return toast.error(error.message);
    toast.success("Comentário salvo.");
  }

  async function reviewDraft(draft: Draft, reviewStatus: "approved" | "rejected") {
    if (!user) return;
    const nextStatus: DraftStatus = reviewStatus === "approved" ? "approved" : "rejected";
    const now = new Date().toISOString();

    const { error } = await igCommentsSupabase
      .from("ig_comment_drafts")
      .update({ review_status: reviewStatus, status: nextStatus, reviewed_at: now, updated_at: now })
      .eq("id", draft.id)
      .eq("user_id", user.id);

    if (error) return toast.error(error.message);

    if (draft.assignment_id) {
      await igCommentsSupabase
        .from("ig_comment_target_accounts")
        .update({ status: reviewStatus, updated_at: now })
        .eq("id", draft.assignment_id)
        .eq("user_id", user.id);
    }

    patchDraft(draft.id, { review_status: reviewStatus, status: nextStatus, reviewed_at: now });
  }

  async function reviewAllPending(reviewStatus: "approved" | "rejected") {
    if (!user || !selectedTarget) return;
    const pending = drafts.filter((draft) => draft.review_status === "pending");
    if (!pending.length) return;

    setBulkReviewing(true);
    try {
      const ids = pending.map((draft) => draft.id);
      const assignmentIds = pending.map((draft) => draft.assignment_id).filter(Boolean) as string[];
      const now = new Date().toISOString();
      const nextStatus = reviewStatus === "approved" ? "approved" : "rejected";

      const { error } = await igCommentsSupabase
        .from("ig_comment_drafts")
        .update({ review_status: reviewStatus, status: nextStatus, reviewed_at: now, updated_at: now })
        .in("id", ids)
        .eq("user_id", user.id);
      if (error) throw error;

      if (assignmentIds.length) {
        const { error: assignmentError } = await igCommentsSupabase
          .from("ig_comment_target_accounts")
          .update({ status: reviewStatus, updated_at: now })
          .in("id", assignmentIds)
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
      }

      await loadTargetWorkspace(user.id, selectedTarget.id);
      toast.success(`${pending.length} comentário${pending.length === 1 ? "" : "s"} ${
        reviewStatus === "approved" ? "aprovado(s)" : "recusado(s)"
      }.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao revisar comentários.");
    } finally {
      setBulkReviewing(false);
    }
  }

  async function queueDraft(draft: Draft) {
    if (!user) return;
    if (draft.review_status !== "approved") {
      toast.error("Aprove o comentário antes de enviar para a fila.");
      return;
    }

    const now = new Date().toISOString();
    const { error } = await igCommentsSupabase
      .from("ig_comment_drafts")
      .update({ status: "queued", queued_at: now, updated_at: now })
      .eq("id", draft.id)
      .eq("user_id", user.id);

    if (error) return toast.error(error.message);

    if (draft.assignment_id) {
      await igCommentsSupabase
        .from("ig_comment_target_accounts")
        .update({ status: "queued", updated_at: now })
        .eq("id", draft.assignment_id)
        .eq("user_id", user.id);
    }

    patchDraft(draft.id, { status: "queued", queued_at: now });
  }

  async function queueAllApproved() {
    if (!user || !selectedTarget) return;
    const ready = drafts.filter(
      (draft) => draft.review_status === "approved" && draft.status !== "queued" && draft.status !== "published",
    );
    if (!ready.length) {
      toast.error("Nenhum comentário aprovado aguardando fila.");
      return;
    }

    setQueueing(true);
    try {
      const ids = ready.map((draft) => draft.id);
      const assignmentIds = ready.map((draft) => draft.assignment_id).filter(Boolean) as string[];
      const now = new Date().toISOString();

      const { error } = await igCommentsSupabase
        .from("ig_comment_drafts")
        .update({ status: "queued", queued_at: now, updated_at: now })
        .in("id", ids)
        .eq("user_id", user.id);
      if (error) throw error;

      if (assignmentIds.length) {
        const { error: assignmentError } = await igCommentsSupabase
          .from("ig_comment_target_accounts")
          .update({ status: "queued", updated_at: now })
          .in("id", assignmentIds)
          .eq("user_id", user.id);
        if (assignmentError) throw assignmentError;
      }

      await loadTargetWorkspace(user.id, selectedTarget.id);
      toast.success(`${ready.length} comentário${ready.length === 1 ? "" : "s"} enviado${ready.length === 1 ? "" : "s"} para a fila.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erro ao montar fila.");
    } finally {
      setQueueing(false);
    }
  }

  async function clearTarget() {
    if (!user || !selectedTarget) return;
    if (!confirm("Apagar esta publicação, seleção de contas e comentários?")) return;

    const { error } = await igCommentsSupabase
      .from("ig_comment_targets")
      .delete()
      .eq("id", selectedTarget.id)
      .eq("user_id", user.id);

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
    setAssignments([]);
    setDrafts([]);
  }

  if (booting) {
    return (
      <div style={{ minHeight: "100vh", background: "#070a0f", display: "grid", placeItems: "center", color: "white" }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ minHeight: "100vh", background: "#070a0f", color: "#f8fafc" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto", padding: 20 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <Logo size="md" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>IG Comments</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Conta → publicação → comentário → aprovação → fila
            </div>
          </div>
          <button onClick={signOut} style={{ ...btn, color: "#cbd5e1", background: "rgba(148,163,184,.08)" }}>
            <LogOut size={14} /> Sair
          </button>
        </header>

        <div className="ig-grid">
          <aside style={{ display: "grid", alignContent: "start", gap: 12 }}>
            <form onSubmit={createTarget} style={cardStyle}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Nova publicação</div>
              <div style={{ display: "grid", gap: 8 }}>
                <input style={inputStyle} value={adUrl} onChange={(e) => setAdUrl(e.target.value)} placeholder="URL da publicação" required />
                <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome interno" />
                <div style={{ color: "#64748b", fontSize: 11 }}>
                  Cole só o link. O AdBrief lê e analisa a publicação automaticamente.
                </div>
                <button disabled={creating} style={{ ...btn, background: "#0ea5e9", color: "white" }}>
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
                </button>
              </div>
            </form>

            <section style={cardStyle}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Publicações</div>
              <div style={{ display: "grid", gap: 6 }}>
                {targets.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 12 }}>Nenhuma publicação ainda.</div>
                ) : (
                  targets.map((target) => (
                    <button
                      key={target.id}
                      onClick={() => setTargetId(target.id)}
                      style={{
                        textAlign: "left",
                        padding: 10,
                        borderRadius: 9,
                        cursor: "pointer",
                        color: "#e2e8f0",
                        background: target.id === targetId ? "rgba(14,165,233,.12)" : "rgba(2,6,23,.45)",
                        border: target.id === targetId ? "1px solid rgba(14,165,233,.35)" : "1px solid rgba(148,163,184,.08)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{target.label || "Sem nome"}</div>
                      <div style={{ color: "#64748b", fontSize: 10, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {target.ad_url}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ fontWeight: 800, flex: 1 }}>Contas conectadas</div>
                <span style={{ color: "#7dd3fc", fontSize: 11 }}>{accounts.length}</span>
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
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,.08)",
                        background: "rgba(2,6,23,.45)",
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "rgba(14,165,233,.12)",
                          display: "grid",
                          placeItems: "center",
                          color: "#7dd3fc",
                          fontWeight: 800,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {(account.username || account.display_name || "IG").slice(0, 1).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>
                          @{accountLabel(account)}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 10 }}>
                          {account.display_name || "Instagram"} · {account.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <main style={{ minWidth: 0 }}>
            {!selectedTarget ? (
              <section style={cardStyle}>Adicione ou selecione uma publicação.</section>
            ) : workspaceLoading ? (
              <section style={{ ...cardStyle, display: "grid", placeItems: "center", minHeight: 220 }}>
                <Loader2 className="animate-spin" />
              </section>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <section style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 17 }}>{selectedTarget.label || "Publicação"}</div>
                      <a href={selectedTarget.ad_url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: 11 }}>
                        {selectedTarget.ad_url}
                      </a>
                      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 11,
                            color:
                              selectedTarget.inspection_status === "ready"
                                ? "#86efac"
                                : selectedTarget.inspection_status === "failed"
                                  ? "#fca5a5"
                                  : "#fbbf24",
                          }}
                        >
                          {inspectingTargetId === selectedTarget.id
                            ? "Analisando link..."
                            : selectedTarget.inspection_status === "ready"
                              ? "Publicação analisada"
                              : selectedTarget.inspection_status === "failed"
                                ? "Falha ao ler publicação"
                                : "Aguardando análise"}
                        </span>
                        {selectedTarget.source_username && (
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>
                            @{selectedTarget.source_username}
                          </span>
                        )}
                      </div>

                      {selectedTarget.source_caption && (
                        <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 12, lineHeight: 1.5 }}>
                          {selectedTarget.source_caption.slice(0, 500)}
                        </div>
                      )}

                      {selectedTarget.visual_summary && (
                        <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 11, lineHeight: 1.5 }}>
                          {selectedTarget.visual_summary}
                        </div>
                      )}

                      {selectedTarget.inspection_status === "failed" && selectedTarget.inspection_error && (
                        <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 11 }}>
                          {selectedTarget.inspection_error}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() =>
                          inspectTarget(selectedTarget).catch((error) =>
                            toast.error(error instanceof Error ? error.message : "Erro ao analisar publicação."),
                          )
                        }
                        disabled={inspectingTargetId === selectedTarget.id}
                        style={{ ...btn, color: "#7dd3fc", background: "rgba(14,165,233,.10)" }}
                      >
                        {inspectingTargetId === selectedTarget.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        Reanalisar link
                      </button>

                      <button onClick={clearTarget} style={{ ...btn, color: "#fca5a5", background: "rgba(239,68,68,.08)" }}>
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  </div>
                </section>

                <section style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, marginRight: "auto" }}>
                      Contas para esta publicação · {selectedAccountIds.size}/{accounts.length}
                    </div>
                    <button onClick={selectAllAccounts} style={{ ...btn, background: "rgba(14,165,233,.10)", color: "#7dd3fc" }}>Todas</button>
                    <button onClick={clearSelectedAccounts} style={{ ...btn, background: "rgba(148,163,184,.08)", color: "#cbd5e1" }}>Nenhuma</button>
                    <button onClick={saveSelection} disabled={savingSelection} style={{ ...btn, background: "rgba(34,197,94,.12)", color: "#86efac" }}>
                      {savingSelection ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar seleção
                    </button>
                  </div>

                  {accounts.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 12 }}>Nenhuma conta Instagram conectada.</div>
                  ) : (
                    <div className="ig-accounts">
                      {accounts.map((account) => {
                        const checked = selectedAccountIds.has(account.id);
                        const assignment = assignments.find((row) => row.social_account_id === account.id);
                        return (
                          <label
                            key={account.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 9,
                              padding: 10,
                              borderRadius: 10,
                              cursor: "pointer",
                              border: checked ? "1px solid rgba(14,165,233,.35)" : "1px solid rgba(148,163,184,.08)",
                              background: checked ? "rgba(14,165,233,.09)" : "rgba(2,6,23,.45)",
                            }}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleAccount(account.id)} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 12 }}>@{accountLabel(account)}</div>
                              <div style={{ color: "#64748b", fontSize: 10 }}>
                                {account.status}{assignment ? ` · ${assignment.status}` : ""}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={generateForSelectedAccounts}
                      disabled={generating || inspectingTargetId === selectedTarget.id || selectedAccountIds.size === 0}
                      style={{ ...btn, background: "#8b5cf6", color: "white" }}
                    >
                      {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Gerar 1 por conta selecionada
                    </button>
                    <span style={{ color: "#64748b", fontSize: 11 }}>Até 100 contas por publicação.</span>
                  </div>
                </section>

                <section style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, marginRight: "auto" }}>Revisão · {drafts.length} comentários</div>
                    <span style={{ color: "#fbbf24", fontSize: 11 }}>Pendentes {reviewCounts.pending}</span>
                    <span style={{ color: "#86efac", fontSize: 11 }}>Aprovados {reviewCounts.approved}</span>
                    <span style={{ color: "#fca5a5", fontSize: 11 }}>Recusados {reviewCounts.rejected}</span>
                    <span style={{ color: "#7dd3fc", fontSize: 11 }}>Fila {reviewCounts.queued}</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <button onClick={() => reviewAllPending("approved")} disabled={bulkReviewing || reviewCounts.pending === 0} style={{ ...btn, background: "rgba(34,197,94,.12)", color: "#86efac" }}>
                      <CheckCheck size={13} /> Aprovar pendentes
                    </button>
                    <button onClick={() => reviewAllPending("rejected")} disabled={bulkReviewing || reviewCounts.pending === 0} style={{ ...btn, background: "rgba(239,68,68,.08)", color: "#fca5a5" }}>
                      <X size={13} /> Recusar pendentes
                    </button>
                    <button onClick={queueAllApproved} disabled={queueing} style={{ ...btn, background: "rgba(14,165,233,.12)", color: "#7dd3fc" }}>
                      {queueing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Enviar aprovados para fila
                    </button>
                  </div>

                  {drafts.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 12 }}>Selecione as contas e gere os comentários.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {drafts.map((draft) => {
                        const account = draft.social_account_id ? accountById.get(draft.social_account_id) : undefined;
                        const approved = draft.review_status === "approved";
                        const rejected = draft.review_status === "rejected";
                        return (
                          <article
                            key={draft.id}
                            style={{
                              borderRadius: 12,
                              padding: 12,
                              border: approved
                                ? "1px solid rgba(34,197,94,.28)"
                                : rejected
                                  ? "1px solid rgba(239,68,68,.25)"
                                  : "1px solid rgba(148,163,184,.10)",
                              background: "rgba(2,6,23,.48)",
                            }}
                          >
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                              <strong style={{ fontSize: 12 }}>@{account ? accountLabel(account) : "conta"}</strong>
                              <span style={{ color: "#64748b", fontSize: 10 }}>{draft.intent}</span>
                              <span style={{ color: approved ? "#86efac" : rejected ? "#fca5a5" : "#fbbf24", fontSize: 10, textTransform: "uppercase" }}>
                                {draft.review_status}
                              </span>
                              <span style={{ color: "#64748b", fontSize: 10 }}>{draft.status}</span>
                            </div>

                            <textarea
                              style={{ ...inputStyle, minHeight: 78, resize: "vertical" }}
                              value={draft.comment_text}
                              disabled={draft.status === "queued" || draft.status === "published"}
                              onChange={(e) => patchDraft(draft.id, { comment_text: e.target.value })}
                            />

                            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
                              <button onClick={() => saveDraft(draft)} disabled={draft.status === "queued" || draft.status === "published"} style={{ ...btn, background: "rgba(148,163,184,.08)", color: "#cbd5e1" }}>
                                <Save size={13} /> Salvar
                              </button>
                              <button onClick={() => reviewDraft(draft, "approved")} disabled={draft.status === "queued" || draft.status === "published"} style={{ ...btn, background: "rgba(34,197,94,.12)", color: "#86efac" }}>
                                <Check size={13} /> Aprovar
                              </button>
                              <button onClick={() => reviewDraft(draft, "rejected")} disabled={draft.status === "queued" || draft.status === "published"} style={{ ...btn, background: "rgba(239,68,68,.08)", color: "#fca5a5" }}>
                                <X size={13} /> Recusar
                              </button>
                              {approved && draft.status !== "queued" && draft.status !== "published" && (
                                <button onClick={() => queueDraft(draft)} style={{ ...btn, background: "rgba(14,165,233,.12)", color: "#7dd3fc" }}>
                                  Enviar para fila
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      <style>{`
        .ig-grid {
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
          gap: 12px;
        }
        .ig-accounts {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 8px;
          max-height: 380px;
          overflow: auto;
          padding-right: 3px;
        }
        @media (max-width: 820px) {
          .ig-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
