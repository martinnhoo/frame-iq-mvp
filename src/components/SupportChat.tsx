import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const INITIAL_MESSAGES: Record<string, string> = {
  en: "Hi! I'm AdBrief Support. Ask me anything about the platform — analyses, boards, billing, or how to get started.",
  pt: "Olá! Sou o suporte AdBrief. Pergunte o que quiser sobre a plataforma — análises, boards, cobrança ou como começar.",
  es: "¡Hola! Soy el soporte de AdBrief. Pregúntame lo que quieras sobre la plataforma.",
  fr: "Bonjour ! Je suis le support AdBrief. Posez-moi vos questions sur la plateforme.",
  de: "Hallo! Ich bin der AdBrief Support. Fragen Sie mich alles zur Plattform.",
  ar: "مرحبًا! أنا دعم AdBrief. اسألني أي شيء عن المنصة.",
  zh: "你好！我是 AdBrief 支持。有任何关于平台的问题都可以问我。",
};

const PLACEHOLDER: Record<string, string> = {
  en: "Ask me anything...",
  pt: "Pergunte qualquer coisa...",
  es: "Pregúntame lo que quieras...",
  fr: "Posez-moi une question...",
  de: "Fragen Sie mich...",
  ar: "اسألني أي شيء...",
  zh: "问我任何问题...",
};

const ERROR_MSG: Record<string, string> = {
  en: "Sorry, I encountered an error. Please try again later.",
  pt: "Desculpe, ocorreu um erro. Tente novamente mais tarde.",
  es: "Lo siento, ocurrió un error. Inténtalo de nuevo más tarde.",
  fr: "Désolé, une erreur s'est produite. Réessayez plus tard.",
  de: "Entschuldigung, ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
  ar: "عذرًا، حدث خطأ. يرجى المحاولة مرة أخرى لاحقًا.",
  zh: "抱歉，发生了错误。请稍后重试。",
};

export default function SupportChat() {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Reset messages when language changes
  useEffect(() => {
    setMessages([
      { role: "assistant", content: INITIAL_MESSAGES[language] || INITIAL_MESSAGES.en },
    ]);
  }, [language]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === "") return;

    const userMessage: Message = { role: "user", content: newMessage };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setNewMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: {
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          language,
        },
      });

      if (error) {
        console.error("Support chat error:", error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: ERROR_MSG[language] || ERROR_MSG.en },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (err) {
      console.error("Error calling support chat:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: ERROR_MSG[language] || ERROR_MSG.en },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const placeholder = PLACEHOLDER[language] || PLACEHOLDER.en;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="w-80 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: "#0e0e14", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="p-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="font-semibold text-sm text-white/80">AdBrief Support</span>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 4 }}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3 h-72 overflow-y-auto flex-grow" ref={chatContainerRef}>
            {messages.map((message, index) => (
              <div key={index} className={`mb-2 ${message.role === "user" ? "text-right" : "text-left"}`}>
                <div className={`inline-block px-3 py-2 rounded-xl text-sm max-w-[85%] ${
                  message.role === "user"
                    ? "text-white rounded-br-sm"
                    : "text-white/70 rounded-bl-sm"
                }`} style={{ background: message.role === "user" ? "linear-gradient(135deg, #0ea5e9, #06b6d4)" : "rgba(255,255,255,0.06)" }}>
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-left mb-2">
                <div className="inline-block px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Loader2 className="h-3 w-3 animate-spin text-white/40" />
                </div>
              </div>
            )}
          </div>
          <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex gap-2">
              <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                rows={1} placeholder={placeholder}
                className="flex-1 rounded-xl text-sm text-white/80 resize-none px-3 py-2 outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }} />
              <button onClick={handleSendMessage} disabled={isLoading}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", border: "none", cursor: "pointer" }}>
                <Send className="h-3.5 w-3.5 text-black" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.3)", cursor: "pointer" }}
          title="Support">
          <MessageCircle className="h-4 w-4" style={{ color: "#0ea5e9" }} />
        </button>
      )}
    </div>
  );
}