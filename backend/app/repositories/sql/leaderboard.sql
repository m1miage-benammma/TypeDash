CREATE OR REPLACE FUNCTION typedash_private.leaderboard() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog SET row_security = off AS $$
    WITH scores AS MATERIALIZED (
        SELECT u.username, u.username_key, AVG(s.wpm) AS average_wpm, MAX(s.wpm) AS best_wpm
        FROM public.users u
        JOIN public.devices d ON d.user_id = u.id
        JOIN public.typing_stats s ON s.device_id = d.id
        GROUP BY u.id, u.username, u.username_key
    ), average_board AS (
        SELECT username, ROUND(average_wpm, 1) AS wpm,
            ROW_NUMBER() OVER (ORDER BY average_wpm DESC, username_key ASC) AS position
        FROM scores ORDER BY average_wpm DESC, username_key ASC LIMIT 10
    ), best_board AS (
        SELECT username, ROUND(best_wpm, 1) AS wpm,
            ROW_NUMBER() OVER (ORDER BY best_wpm DESC, username_key ASC) AS position
        FROM scores ORDER BY best_wpm DESC, username_key ASC LIMIT 10
    )
    SELECT jsonb_build_object(
        'average', COALESCE((SELECT jsonb_agg(jsonb_build_object('username', username, 'wpm', wpm) ORDER BY position) FROM average_board), '[]'::jsonb),
        'top_speed', COALESCE((SELECT jsonb_agg(jsonb_build_object('username', username, 'wpm', wpm) ORDER BY position) FROM best_board), '[]'::jsonb)
    );
$$;
REVOKE ALL ON FUNCTION typedash_private.leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typedash_private.leaderboard() TO typedash_runtime;
