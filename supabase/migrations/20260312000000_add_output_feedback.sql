-- output_feedback: stores thumbs up/down on AI-generated outputs
-- Used to train the AI profile and improve future generations

CREATE TABLE IF NOT EXISTS output_feedback (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_type text NOT NULL, -- 'analysis', 'board', 'brief', 'hook', 'caption', 'script'
  source_id   text,          -- id of the source row (optional)
  rating      smallint NOT NULL CHECK (rating IN (-1, 1)), -- -1 = bad, 1 = good
  output_text text,          -- the actual AI output that was rated
  context     jsonb,         -- extra context: platform, market, hook_type, format, etc.
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE output_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own feedback"
  ON output_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON output_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
  ON output_feedback FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_output_feedback_user_id ON output_feedback(user_id);
CREATE INDEX idx_output_feedback_source ON output_feedback(source_type, source_id);
CREATE INDEX idx_output_feedback_rating ON output_feedback(user_id, rating);
