import { useState } from "react";
import { Search, Eye, TrendingUp, Clock, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const MARKETS = [
  { value: "BR", label: "🇧🇷 Brazil" },
  { value: "MX", label: "🇲🇽 Mexico" },
  { value: "IN", label: "🇮🇳 India" },
  { value: "US", label: "🇺🇸 United States" },
  { value: "GB", label: "🇬🇧 United Kingdom" },
  { value: "GLOBAL", label: "🌐 Global" },
];

const MOCK_COMPETITORS = [
  {
    id: "1",
    name: "Betway",
    market: "BR",
    platform: "Meta",
    ads_count: 47,
    new_this_week: 8,
    last_seen: "2h ago",
    top_format: "UGC",
    avg_hook_score: 7.8,
    status: "active",
  },
  {
    id: "2",
    name: "Sportingbet",
    market: "BR",
    platform: "TikTok",
    ads_count: 23,
    new_this_week: 3,
    last_seen: "5h ago",
    top_format: "Promo",
    avg_hook_score: 6.4,
    status: "active",
  },
  {
    id: "3",
    name: "1xBet",
    market: "IN",
    platform: "Meta",
    ads_count: 91,
    new_this_week: 14,
    last_seen: "30m ago",
    top_format: "Testimonial",
    avg_hook_score: 8.1,
    status: "active",
  },
];

const MOCK_RECENT_ADS = [
  {
    id: "1",
    competitor: "Betway",
    platform: "Meta",
    format: "UGC",
    hook_score: 8.4,
    detected: "2h ago",
    hook_preview: "Guy looks at camera: 'I turned R$50 into R$800 yesterday'",
    market: "BR",
  },
  {
    id: "2",
    competitor: "1xBet",
    platform: "TikTok",
    format: "Promo",
    hook_score: 7.9,
    detected: "4h ago",
    hook_preview: "Fast cuts of wins + 'Get 500% bonus today only'",
    market: "IN",
  },
  {
    id: "3",
    competitor: "Sportingbet",
    platform: "Meta",
    format: "Testimonial",
    hook_score: 6.8,
    detected: "6h ago",
    hook_preview: "Woman smiling: 'This changed how I watch football'",
    market: "BR",
  },
];

export default function CompetitorTracker() {
  const [search, setSearch] = useState("");
  const [market, setMarket] = useState("BR");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    toast.success(`Tracking "${newName}" — API connection needed for live data.`);
    setNewName("");
    setAdding(false);
  };

  const filtered = MOCK_COMPETITORS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Eye className="h-6 w-6" /> Competitor Tracker
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor competitor ads across Meta and TikTok in real time.</p>
        </div>
        <Button onClick={() => setAdding(true)} className="bg-white text-black hover:bg-white/90">
          <Plus className="h-4 w-4 mr-2" /> Add Competitor
        </Button>
      </div>

      {/* Add competitor */}
      {adding && (
        <Card className="bg-[#0a0a0a] border-[#333]">
          <CardContent className="p-4 flex gap-3">
            <Input
              placeholder="Brand or company name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="bg-[#111] border-[#333] text-white flex-1"
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger className="bg-[#111] border-[#333] text-white w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111] border-[#333]">
                {MARKETS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} className="bg-white text-black hover:bg-white/90">Track</Button>
            <Button variant="ghost" onClick={() => setAdding(false)} className="text-muted-foreground">Cancel</Button>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search competitors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[#0a0a0a] border-[#222] text-white pl-9"
        />
      </div>

      {/* Competitors table */}
      <Card className="bg-[#0a0a0a] border-[#222]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest">Tracked Competitors</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a]">
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">Brand</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">Market</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">Platform</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">Total Ads</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">New this week</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">Top Format</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">Avg Hook</th>
                <th className="px-4 py-3 text-left text-xs text-muted-foreground font-normal">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-[#1a1a1a] hover:bg-white/[0.02] cursor-pointer">
                  <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.market}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.platform}</td>
                  <td className="px-4 py-3 text-white font-mono text-xs">{c.ads_count}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-400 font-mono text-xs">+{c.new_this_week}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded border border-[#333] text-white/70">{c.top_format}</span>
                  </td>
                  <td className="px-4 py-3 text-white font-mono text-xs">{c.avg_hook_score}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />{c.last_seen}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Recent ads feed */}
      <div>
        <h2 className="text-sm text-muted-foreground uppercase tracking-widest mb-3">Recent Ads Detected</h2>
        <div className="space-y-3">
          {MOCK_RECENT_ADS.map((ad) => (
            <Card key={ad.id} className="bg-[#0a0a0a] border-[#222] hover:border-[#333] transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{ad.competitor}</span>
                      <span className="text-xs px-2 py-0.5 rounded border border-[#333] text-white/50">{ad.platform}</span>
                      <span className="text-xs px-2 py-0.5 rounded border border-[#333] text-white/50">{ad.format}</span>
                      <span className="text-xs text-muted-foreground">{ad.market}</span>
                    </div>
                    <p className="text-white/60 text-xs font-mono">"{ad.hook_preview}"</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white font-mono text-lg font-bold">{ad.hook_score}</div>
                    <div className="text-muted-foreground text-xs">hook score</div>
                    <div className="text-muted-foreground text-xs mt-1">{ad.detected}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Notice */}
      <Card className="bg-[#0a0a0a] border-[#333] border-dashed">
        <CardContent className="p-4 text-center">
          <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Live competitor tracking requires Meta Ads API and TikTok API connection.</p>
          <p className="text-muted-foreground text-xs mt-1">Data above is a preview. Connect your API keys to enable real monitoring.</p>
        </CardContent>
      </Card>
    </div>
  );
}
