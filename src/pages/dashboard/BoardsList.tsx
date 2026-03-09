import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Plus, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Board {
  id: string;
  title: string | null;
  prompt: string | null;
  status: string;
  created_at: string;
}

const BoardsList = () => {
  const { user } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("boards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setBoards(data);
      setLoading(false);
    };
    fetch();
  }, [user.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Boards</h1>
          <p className="text-muted-foreground text-sm mt-1">Your production boards and storyboards.</p>
        </div>
        <Button
          onClick={() => navigate("/dashboard/boards/new")}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Board
        </Button>
      </div>

      {boards.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <LayoutGrid className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No boards yet</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm">
              Describe your ad concept and get a full production board with scenes, scripts, and notes.
            </p>
            <Button
              onClick={() => navigate("/dashboard/boards/new")}
              variant="outline"
              className="border-border"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create your first board
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Card
              key={board.id}
              className="border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Badge variant="outline" className="capitalize text-xs border-border text-muted-foreground">
                    {board.status}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium text-foreground truncate">{board.title || "Untitled Board"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(board.created_at), { addSuffix: true })}
                  </p>
                </div>
                {board.prompt && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{board.prompt}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BoardsList;
