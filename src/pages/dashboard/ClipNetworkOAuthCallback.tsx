/* eslint-disable @typescript-eslint/no-explicit-any -- edge function response is untyped JSON. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function ClipNetworkOAuthCallback(){
  const {platform}=useParams<{platform:string}>(); const navigate=useNavigate(); const [state,setState]=useState<"loading"|"ok"|"error">("loading"); const [message,setMessage]=useState("Conectando conta…");
  useEffect(()=>{const timers: ReturnType<typeof setTimeout>[]=[];(async()=>{try{
    if(platform!=="instagram") throw new Error("Integração não habilitada para esta plataforma");
    const q=new URLSearchParams(window.location.search); const code=q.get("code"), oauthState=q.get("state"), err=q.get("error")||q.get("error_reason"); if(err)throw new Error(q.get("error_description")||"Conexão cancelada"); if(!code||!oauthState)throw new Error("Callback OAuth incompleto");
    const {data:{session},error:sessionError}=await supabase.auth.getSession(); if(sessionError)throw sessionError;
    const accessToken=session?.access_token; if(!accessToken)throw new Error("Sessão expirada");
    const response=await fetch(CLIP_INSTAGRAM_OAUTH_URL,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${accessToken}`},body:JSON.stringify({action:"exchange_code",code,state:oauthState})});
    const raw=await response.text(); let data:any={}; try{data=raw?JSON.parse(raw):{};}catch{throw new Error(`Resposta inválida do Clip Network (${response.status})`);}
    if(!response.ok||data?.error)throw new Error(data?.error||`Falha ao conectar Instagram (${response.status})`);
    setState("ok");setMessage(`Instagram conectado${data?.connected?.username?` como @${data.connected.username}`:""}.`);timers.push(setTimeout(()=>navigate("/dashboard/clips"),1200));
  }catch(e){setState("error");setMessage(e instanceof Error?e.message:String(e));timers.push(setTimeout(()=>navigate("/dashboard/clips"),3500));}})();return()=>timers.forEach(clearTimeout);},[navigate,platform]);
  return <div className="flex min-h-[70vh] items-center justify-center p-6"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.035] p-8 text-center">{state==='loading'?<Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-300"/>:state==='ok'?<CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300"/>:<XCircle className="mx-auto h-8 w-8 text-red-300"/>}<div className="mt-4 text-sm font-medium text-white">{message}</div></div></div>;
}
