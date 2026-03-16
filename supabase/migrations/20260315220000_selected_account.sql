-- Add selected_account_id to platform_connections
-- Allows each persona to designate which specific ad account to use

alter table platform_connections
  add column if not exists selected_account_id text;

comment on column platform_connections.selected_account_id is
  'The specific ad account ID chosen for this persona from the list of available accounts.';
