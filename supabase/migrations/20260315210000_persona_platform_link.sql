-- Add persona_id to platform_connections
-- Allows each persona (client) to have its own connected platforms

alter table platform_connections 
  add column if not exists persona_id uuid references personas(id) on delete set null;

-- Index for persona-based lookups
create index if not exists idx_platform_connections_persona 
  on platform_connections(persona_id) where persona_id is not null;

-- Update RLS to still use user_id (persona is optional filter)
-- Existing policy already covers this via user_id

comment on column platform_connections.persona_id is 
  'Optional: links this connection to a specific persona/client workspace. NULL = account-level connection.';
