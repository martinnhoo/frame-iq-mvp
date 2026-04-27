-- Add reactivate_campaign to the action_log CHECK constraint.
-- Why: cascade activation now flips campaigns + adsets + ads in a single
-- pass. The named target on the action_log row is whatever the user
-- clicked, so when they click "ativar campanha" the row needs
-- action_type = 'reactivate_campaign'. The original constraint shipped
-- without it (only ad + adset reactivate) and the workaround was to log
-- campaign reactivations as 'reactivate_adset', which is misleading and
-- breaks per-type analytics. Expand the enum in place.

ALTER TABLE action_log DROP CONSTRAINT IF EXISTS action_log_action_type_check;

ALTER TABLE action_log ADD CONSTRAINT action_log_action_type_check
  CHECK (action_type IN (
    'pause_ad', 'pause_adset', 'pause_campaign',
    'reactivate_ad', 'reactivate_adset', 'reactivate_campaign',
    'increase_budget', 'decrease_budget',
    'duplicate_ad', 'generate_hook', 'generate_variation'
  ));
