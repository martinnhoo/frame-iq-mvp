import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { Button } from "@/components/ui/button";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = storage.get("adbrief-cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => { storage.set("adbrief-cookie-consent", "accepted"); setVisible(false); };
  const decline = () => { storage.set("adbrief-cookie-consent", "declined"); setVisible(false); };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[400] p-4 md:p-6"
      style={{ animation: "slideUp 0.3s ease" }}>
      <div className="max-w-3xl mx-auto rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-4"
        style={{ background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(20px)', boxShadow: '0 -10px 40px rgba(0,0,0,0.5)' }}>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground mb-1">🍪 We use cookies</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We use essential cookies to ensure the website functions properly, and analytics cookies to understand how you interact with it.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={decline}>Decline</Button>
          <Button size="sm" className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0 text-xs" onClick={accept}>Accept all</Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
