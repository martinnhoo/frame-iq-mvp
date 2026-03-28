-- Trigger aggregate-intelligence immediately to build first global benchmarks
-- This runs it once now — the weekly Saturday cron handles future runs
SELECT adbrief_invoke_function('aggregate-intelligence', '{}');
