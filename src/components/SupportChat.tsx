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
        <div className="w-96 rounded-lg shadow-lg overflow-hidden flex flex-col bg-background border border-border">
          <div className="bg-muted p-4 flex items-center justify-between border-b border-border">
            <span className="font-semibold text-sm text-foreground">AdBrief Support</span>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 h-80 overflow-y-auto flex-grow flex-shrink" ref={chatContainerRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-2 ${message.role === "user" ? "text-right" : "text-left"}`}
              >
                <div
                  className={`inline-block p-2 rounded-lg text-sm max-w-[85%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-muted text-foreground rounded-bl-none"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-left mb-2">
                <div className="inline-block p-2 rounded-lg text-sm bg-muted text-foreground rounded-bl-none">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-border">
            <div className="flex rounded-md shadow-sm gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                className="block w-full rounded-md border border-border bg-background py-1.5 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary sm:text-sm sm:leading-6 px-3 resize-none"
                placeholder={placeholder}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={handleSendMessage}
                disabled={isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button onClick={() => setIsOpen(true)} className="rounded-full">
          <MessageCircle className="h-4 w-4 mr-2" /> Support
        </Button>
      )}
    </div>
  );
}