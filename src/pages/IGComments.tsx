/* eslint-disable @typescript-eslint/no-explicit-any -- this page uses an isolated backend whose schema is intentionally not merged with legacy generated types. */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Check, CheckCircle2, Clipboard, Instagram, Loader2, LogOut, Plus,
  RefreshCw, Save, ShieldCheck, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { igCommentsSupabase } from "@/integrations/supabase/igCommentsClient";

const db = igCommentsSupabase as any;
type Account = { id:string; user_id:string; label:string; instagram_username:string; tone:string|null; status:string; authorization_confirmed:boolean };
type Target = { id:string; user_id:string; ad_url:string; ad_label:string; source_context:string|null; created_at:string };
type DraftStatus = "draft"|"approved"|"rejected"|"posted";
type Draft = { id:string; user_id:string; target_id:string; account_id:string|null; body:string; angle:string|null; status:DraftStatus; created_at:string; updated_at?:string };
type Filter = "all"|DraftStatus;

const field = "w-full rounded-lg border border-white/10 bg-white/[.035] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-white/25 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10";
const card = "rounded-lg border border-white/[.07] bg-[var(--color-surface-1)]";
const statusTone:Record<DraftStatus,string> = {
  draft:"border-white/10 bg-white/5 text-white/55", approved:"border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  rejected:"border-red-400/20 bg-red-400/10 text-red-300", posted:"border-sky-400/20 bg-sky-400/10 text-sky-300",
};

function message(error:unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function IGComments() {
  const [session,setSession]=useState<Session|null>(null);
  const [checking,setChecking]=useState(true);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [authBusy,setAuthBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [targets,setTargets]=useState<Target[]>([]);
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [selectedTargetId,setSelectedTargetId]=useState<string|null>(null);
  const [filter,setFilter]=useState<Filter>("all");
  const [adUrl,setAdUrl]=useState("");
  const [adLabel,setAdLabel]=useState("");
  const [sourceContext,setSourceContext]=useState("");
  const [count,setCount]=useState(6);
  const [accountForm,setAccountForm]=useState({ id:"", label:"", instagram_username:"", tone:"", status:"active", authorization_confirmed:false });

  useEffect(()=>{
    let active=true;
    igCommentsSupabase.auth.getSession().then(({data})=>{ if(active){setSession(data.session);setChecking(false);} });
    const {data:{subscription}}=igCommentsSupabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setChecking(false);});
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);

  const loadAll=useCallback(async()=>{
    if(!session?.user.id)return;
    setLoading(true);setError(null);
    try {
      const [accountResult,targetResult]=await Promise.all([
        db.from("ig_comment_accounts").select("*").eq("user_id",session.user.id).order("created_at",{ascending:true}),
        db.from("ig_comment_targets").select("*").eq("user_id",session.user.id).order("created_at",{ascending:false}),
      ]);
      if(accountResult.error)throw accountResult.error;
      if(targetResult.error)throw targetResult.error;
      setAccounts(accountResult.data||[]);setTargets(targetResult.data||[]);
      setSelectedTargetId(current=>current||(targetResult.data?.[0]?.id??null));
    } catch(cause){setError(message(cause));} finally{setLoading(false);}
  },[session?.user.id]);

  const loadDrafts=useCallback(async()=>{
    if(!session?.user.id||!selectedTargetId){setDrafts([]);return;}
    const {data,error:queryError}=await db.from("ig_comment_drafts").select("*").eq("user_id",session.user.id).eq("target_id",selectedTargetId).order("created_at",{ascending:true});
    if(queryError){setError(queryError.message);return;} setDrafts(data||[]);
  },[selectedTargetId,session?.user.id]);
  useEffect(()=>{if(session)void loadAll();},[session,loadAll]);
  useEffect(()=>{void loadDrafts();},[loadDrafts]);

  const logEvent=async(eventType:string,targetId:string,draftId?:string)=>{
    if(!session?.user.id)return;
    const {error:eventError}=await db.from("ig_comment_events").insert({user_id:session.user.id,target_id:targetId,draft_id:draftId||null,event_type:eventType});
    if(eventError)console.warn("[ig-comments-event]",eventError.message);
  };

  const signIn=async(event:React.FormEvent)=>{
    event.preventDefault();setAuthBusy(true);
    try{const {error:authError}=await igCommentsSupabase.auth.signInWithPassword({email:email.trim(),password});if(authError)throw authError;toast.success("Signed in to IG Comments");}
    catch(cause){toast.error(message(cause));}finally{setAuthBusy(false);}
  };

  const saveAccount=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!session?.user.id||!accountForm.authorization_confirmed){toast.error("Confirm that this account is authorized before saving.");return;}
    setBusy("account");
    try{
      const payload={user_id:session.user.id,label:accountForm.label.trim(),instagram_username:accountForm.instagram_username.trim().replace(/^@/,""),tone:accountForm.tone.trim()||null,status:accountForm.status,authorization_confirmed:true};
      const result=accountForm.id?await db.from("ig_comment_accounts").update(payload).eq("id",accountForm.id).eq("user_id",session.user.id):await db.from("ig_comment_accounts").insert(payload);
      if(result.error)throw result.error;
      setAccountForm({id:"",label:"",instagram_username:"",tone:"",status:"active",authorization_confirmed:false});await loadAll();toast.success("Authorized account saved");
    }catch(cause){toast.error(message(cause));}finally{setBusy(null);}
  };

  const deleteAccount=async(id:string)=>{
    if(!session?.user.id||!window.confirm("Delete this authorized account?"))return;
    setBusy(`account-${id}`);const {error:deleteError}=await db.from("ig_comment_accounts").delete().eq("id",id).eq("user_id",session.user.id);setBusy(null);
    if(deleteError)toast.error(deleteError.message);else{await loadAll();toast.success("Account deleted");}
  };

  const createTarget=async(event:React.FormEvent)=>{
    event.preventDefault();if(!session?.user.id)return;setBusy("target");
    try{const {data,error:insertError}=await db.from("ig_comment_targets").insert({user_id:session.user.id,ad_url:adUrl.trim(),ad_label:adLabel.trim(),source_context:sourceContext.trim()||null}).select("*").single();if(insertError)throw insertError;setTargets(current=>[data,...current]);setSelectedTargetId(data.id);setAdUrl("");setAdLabel("");setSourceContext("");toast.success("Target created");}
    catch(cause){toast.error(message(cause));}finally{setBusy(null);}
  };

  const deleteTarget=async()=>{
    if(!session?.user.id||!selectedTargetId||!window.confirm("Delete this target and its drafts?"))return;
    setBusy("delete-target");const {error:deleteError}=await db.from("ig_comment_targets").delete().eq("id",selectedTargetId).eq("user_id",session.user.id);setBusy(null);
    if(deleteError)toast.error(deleteError.message);else{setSelectedTargetId(null);setDrafts([]);await loadAll();toast.success("Target deleted");}
  };

  const clearDrafts=async()=>{
    if(!session?.user.id||!selectedTargetId||!window.confirm("Clear all drafts for this target?"))return;
    setBusy("clear");const {error:deleteError}=await db.from("ig_comment_drafts").delete().eq("target_id",selectedTargetId).eq("user_id",session.user.id);setBusy(null);
    if(deleteError)toast.error(deleteError.message);else{setDrafts([]);toast.success("Drafts cleared");}
  };

  const generate=async()=>{
    const target=targets.find(item=>item.id===selectedTargetId);const authorized=accounts.filter(item=>item.authorization_confirmed&&item.status==="active");
    if(!session?.user.id||!target)return;if(!authorized.length){toast.error("Add at least one active authorized account first.");return;}
    setBusy("generate");
    try{
      const {data,error:functionError}=await igCommentsSupabase.functions.invoke("ig-comments-ai",{body:{ad_url:target.ad_url,ad_label:target.ad_label,source_context:target.source_context,count,accounts:authorized.map(({id,label,instagram_username,tone,status,authorization_confirmed})=>({id,label,instagram_username,tone,status,authorization_confirmed}))}});
      if(functionError)throw functionError;
      const generated=Array.isArray(data?.drafts)?data.drafts:[];if(!generated.length)throw new Error("The AI returned no drafts.");
      const rows=generated.slice(0,count).map((item:any)=>({user_id:session.user.id,target_id:target.id,account_id:item.account_id||null,body:String(item.body||"").trim(),angle:String(item.angle||"").trim()||null,status:"draft"}));
      const {error:insertError}=await db.from("ig_comment_drafts").insert(rows);if(insertError)throw insertError;
      await logEvent("generated",target.id);await loadDrafts();toast.success(`${rows.length} drafts generated`);
    }catch(cause){toast.error(message(cause));}finally{setBusy(null);}
  };

  const updateDraft=async(draft:Draft,updates:Partial<Draft>,eventType?:string)=>{
    if(!session?.user.id||!selectedTargetId)return;setBusy(draft.id);
    const {error:updateError}=await db.from("ig_comment_drafts").update({...updates,updated_at:new Date().toISOString()}).eq("id",draft.id).eq("user_id",session.user.id);setBusy(null);
    if(updateError){toast.error(updateError.message);return;}setDrafts(current=>current.map(item=>item.id===draft.id?{...item,...updates}:item));if(eventType)await logEvent(eventType,selectedTargetId,draft.id);toast.success(eventType==="edited"?"Draft saved":`Draft ${updates.status}`);
  };

  const copyDraft=async(draft:Draft)=>{try{await navigator.clipboard.writeText(draft.body);toast.success("Copied to clipboard");}catch{toast.error("Could not copy this draft.");}};
  const visibleDrafts=useMemo(()=>filter==="all"?drafts:drafts.filter(item=>item.status===filter),[drafts,filter]);
  const selectedTarget=targets.find(item=>item.id===selectedTargetId);

  if(checking)return <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-0)]"><Loader2 className="h-6 w-6 animate-spin text-sky-400"/></div>;
  if(!session)return <main className="flex min-h-screen items-center justify-center bg-[var(--color-surface-0)] px-4"><form onSubmit={signIn} className={`${card} w-full max-w-sm p-6 shadow-2xl`}><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300"><Instagram className="h-5 w-5"/></div><h1 className="mt-5 text-xl font-bold text-white">IG Comments</h1><p className="mt-2 text-xs leading-5 text-white/45">Sign in to the dedicated review workspace.</p><div className="mt-6 space-y-3"><input className={field} type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="Email" required/><input className={field} type="password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Password" required/><Button type="submit" disabled={authBusy} className="w-full bg-sky-500 text-white hover:bg-sky-400">{authBusy&&<Loader2 className="animate-spin"/>}Sign in</Button></div></form></main>;

  return <main className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
    <header className="border-b border-white/[.07] bg-[var(--color-surface-1)]"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"><div><div className="flex items-center gap-2"><Instagram className="h-5 w-5 text-sky-400"/><h1 className="text-lg font-bold">IG Comments</h1></div><p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/40"><ShieldCheck className="h-3 w-3 text-emerald-400"/>Authorized accounts only · review and copy, never auto-post</p></div><Button variant="ghost" size="sm" onClick={()=>igCommentsSupabase.auth.signOut()} className="text-white/55 hover:bg-white/5 hover:text-white"><LogOut/>Sign out</Button></div></header>
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[320px_1fr]">
      <aside className="space-y-5">
        <section className={`${card} p-4`}><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Authorized accounts</h2><span className="text-[10px] text-white/35">{accounts.length}</span></div>
          <div className="mt-3 space-y-2">{accounts.map(account=><div key={account.id} className="rounded-lg border border-white/[.07] bg-white/[.025] p-3"><div className="flex justify-between gap-2"><button type="button" onClick={()=>setAccountForm({...account,tone:account.tone||""})} className="min-w-0 text-left"><div className="truncate text-xs font-semibold text-white">{account.label}</div><div className="mt-1 text-[11px] text-white/40">@{account.instagram_username} · {account.status}</div></button><Button variant="ghost" size="icon" onClick={()=>deleteAccount(account.id)} disabled={busy===`account-${account.id}`} className="h-8 w-8 text-white/35 hover:bg-red-500/10 hover:text-red-300"><Trash2/></Button></div></div>)}</div>
          <form onSubmit={saveAccount} className="mt-4 space-y-2 border-t border-white/[.07] pt-4"><input className={field} value={accountForm.label} onChange={event=>setAccountForm(current=>({...current,label:event.target.value}))} placeholder="Account label" required/><input className={field} value={accountForm.instagram_username} onChange={event=>setAccountForm(current=>({...current,instagram_username:event.target.value}))} placeholder="Instagram username" required/><input className={field} value={accountForm.tone} onChange={event=>setAccountForm(current=>({...current,tone:event.target.value}))} placeholder="Tone (optional)"/><select className={field} value={accountForm.status} onChange={event=>setAccountForm(current=>({...current,status:event.target.value}))}><option value="active">Active</option><option value="paused">Paused</option></select><label className="flex cursor-pointer items-start gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[.04] p-3 text-[11px] leading-4 text-white/55"><input className="mt-0.5 accent-sky-500" type="checkbox" checked={accountForm.authorization_confirmed} onChange={event=>setAccountForm(current=>({...current,authorization_confirmed:event.target.checked}))}/><span>I confirm I am authorized to use this Instagram account for drafting comments.</span></label><div className="flex gap-2"><Button type="submit" size="sm" disabled={busy==="account"} className="flex-1 bg-sky-500 text-white hover:bg-sky-400">{accountForm.id?<Save/>:<Plus/>}{accountForm.id?"Save":"Add account"}</Button>{accountForm.id&&<Button type="button" size="sm" variant="outline" onClick={()=>setAccountForm({id:"",label:"",instagram_username:"",tone:"",status:"active",authorization_confirmed:false})}><X/></Button>}</div></form>
        </section>
        <section className={`${card} p-4`}><h2 className="text-sm font-semibold">Ad targets</h2><div className="mt-3 space-y-2">{targets.map(target=><button type="button" key={target.id} onClick={()=>setSelectedTargetId(target.id)} className={`w-full rounded-lg border p-3 text-left transition ${selectedTargetId===target.id?"border-sky-400/35 bg-sky-400/[.07]":"border-white/[.07] bg-white/[.025] hover:border-white/15"}`}><div className="truncate text-xs font-semibold text-white">{target.ad_label}</div><div className="mt-1 truncate text-[10px] text-white/35">{target.ad_url}</div></button>)}</div>
          <form onSubmit={createTarget} className="mt-4 space-y-2 border-t border-white/[.07] pt-4"><input className={field} type="url" value={adUrl} onChange={event=>setAdUrl(event.target.value)} placeholder="Ad URL" required/><input className={field} value={adLabel} onChange={event=>setAdLabel(event.target.value)} placeholder="Ad label" required/><textarea className={field} rows={3} value={sourceContext} onChange={event=>setSourceContext(event.target.value)} placeholder="Context or brief (optional)"/><Button type="submit" size="sm" disabled={busy==="target"} className="w-full bg-sky-500 text-white hover:bg-sky-400"><Plus/>Create target</Button></form>
        </section>
      </aside>
      <section className="min-w-0">
        {error&&<div className="mb-4 flex items-center justify-between rounded-lg border border-red-400/20 bg-red-400/[.07] px-4 py-3 text-xs text-red-200"><span>{error}</span><Button variant="ghost" size="sm" onClick={loadAll}><RefreshCw/>Retry</Button></div>}
        {loading?<div className={`${card} flex min-h-64 items-center justify-center`}><Loader2 className="h-6 w-6 animate-spin text-sky-400"/></div>:!selectedTarget?<div className={`${card} flex min-h-64 flex-col items-center justify-center px-6 text-center`}><Sparkles className="h-7 w-7 text-sky-400"/><h2 className="mt-4 text-base font-semibold">Create your first ad target</h2><p className="mt-2 max-w-sm text-xs leading-5 text-white/40">Add an ad URL and context, then generate account-aware drafts for review.</p></div>:<>
          <div className={`${card} p-4 sm:p-5`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[.08em] text-sky-400">Active target</div><h2 className="mt-1 truncate text-lg font-bold">{selectedTarget?.ad_label}</h2><a href={selectedTarget?.ad_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-white/40 hover:text-sky-300">{selectedTarget?.ad_url}</a>{selectedTarget?.source_context&&<p className="mt-3 text-xs leading-5 text-white/50">{selectedTarget.source_context}</p>}</div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={clearDrafts} disabled={!drafts.length||busy==="clear"><X/>Clear drafts</Button><Button variant="outline" size="sm" onClick={deleteTarget} disabled={busy==="delete-target"} className="text-red-300 hover:text-red-200"><Trash2/>Delete</Button></div></div><div className="mt-5 flex flex-col gap-3 border-t border-white/[.07] pt-4 sm:flex-row sm:items-end"><label className="text-[10px] font-bold uppercase tracking-[.08em] text-white/35">Draft count<input className={`${field} mt-1 w-28`} type="number" min={1} max={30} value={count} onChange={event=>setCount(Math.min(30,Math.max(1,Number(event.target.value)||1)))}/></label><Button onClick={generate} disabled={busy==="generate"} className="bg-sky-500 text-white hover:bg-sky-400">{busy==="generate"?<Loader2 className="animate-spin"/>:<Sparkles/>}Generate drafts</Button></div></div>
          <div className="mt-4 flex flex-wrap gap-2">{(["all","draft","approved","rejected","posted"] as Filter[]).map(item=><Button key={item} variant={filter===item?"default":"outline"} size="sm" onClick={()=>setFilter(item)} className={filter===item?"bg-white text-black":"text-white/55"}>{item} · {item==="all"?drafts.length:drafts.filter(draft=>draft.status===item).length}</Button>)}</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">{visibleDrafts.map(draft=><article key={draft.id} className={`${card} border-l-2 border-l-sky-400 p-4`}><div className="flex items-center justify-between gap-3"><span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold text-violet-200">{draft.angle||"General"}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusTone[draft.status]}`}>{draft.status}</span></div><textarea className={`${field} mt-3 min-h-28 resize-y leading-6`} value={draft.body} onChange={event=>setDrafts(current=>current.map(item=>item.id===draft.id?{...item,body:event.target.value}:item))}/><select className={`${field} mt-2`} value={draft.account_id||""} onChange={event=>setDrafts(current=>current.map(item=>item.id===draft.id?{...item,account_id:event.target.value||null}:item))}><option value="">No account selected</option>{accounts.filter(account=>account.authorization_confirmed).map(account=><option key={account.id} value={account.id}>{account.label} · @{account.instagram_username}</option>)}</select><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Button variant="outline" size="sm" onClick={()=>updateDraft(draft,{body:draft.body,account_id:draft.account_id},"edited")} disabled={busy===draft.id}><Save/>Save</Button><Button variant="outline" size="sm" onClick={()=>updateDraft(draft,{status:"approved"},"approved")} disabled={busy===draft.id} className="text-emerald-300"><Check/>Approve</Button><Button variant="outline" size="sm" onClick={()=>updateDraft(draft,{status:"rejected"},"rejected")} disabled={busy===draft.id} className="text-red-300"><X/>Reject</Button><Button variant="outline" size="sm" onClick={()=>copyDraft(draft)}><Clipboard/>Copy</Button></div></article>)}</div>
          {!visibleDrafts.length&&<div className={`${card} mt-4 flex min-h-40 flex-col items-center justify-center text-center`}><CheckCircle2 className="h-6 w-6 text-white/20"/><p className="mt-3 text-xs text-white/40">No drafts in this view.</p></div>}
        </>}
      </section>
    </div>
  </main>;
}