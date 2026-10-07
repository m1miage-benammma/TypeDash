CREATE OR REPLACE FUNCTION typedash_private.leaderboard() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog SET row_security = off AS $$
    WITH viewer AS (
        SELECT user_id FROM public.devices
        WHERE id = NULLIF(current_setting('typedash.device_id', true), '')::uuid
    ), session_scores AS MATERIALIZED (
        SELECT u.id, u.username, u.username_key, s.id AS stat_id, s.wpm,
            s.difficulty, s.finished_at
        FROM public.users u
        JOIN public.devices d ON d.user_id = u.id
        JOIN public.typing_stats s ON s.device_id = d.id
    ), scores AS (
        SELECT id, username, username_key, AVG(wpm) AS average_wpm,
            CASE WHEN MIN(difficulty) = MAX(difficulty)
                THEN MIN(difficulty) ELSE 'mixed' END AS average_difficulty
        FROM session_scores
        GROUP BY id, username, username_key
    ), best_scores AS (
        SELECT DISTINCT ON (id) id, difficulty AS best_difficulty, wpm AS best_wpm
        FROM session_scores
        ORDER BY id, wpm DESC, finished_at DESC, stat_id DESC
    ), average_board AS (
        SELECT username, ROUND(average_wpm, 1) AS wpm, average_difficulty AS difficulty,
            COALESCE(id = (SELECT user_id FROM viewer), false) AS is_current,
            COUNT(*) OVER () AS total,
            ROW_NUMBER() OVER (ORDER BY average_wpm DESC, username_key ASC) AS position
        FROM scores
    ), best_board AS (
        SELECT scores.username, ROUND(best_scores.best_wpm, 1) AS wpm,
            best_scores.best_difficulty AS difficulty,
            COALESCE(scores.id = (SELECT user_id FROM viewer), false) AS is_current,
            COUNT(*) OVER () AS total,
            ROW_NUMBER() OVER (ORDER BY best_scores.best_wpm DESC, scores.username_key ASC) AS position
        FROM scores JOIN best_scores USING (id)
    )
    SELECT jsonb_build_object(
        'average', COALESCE((SELECT jsonb_agg(jsonb_build_object('username', username, 'wpm', wpm,
            'difficulty', difficulty, 'rank', position, 'is_current', is_current) ORDER BY position)
            FROM average_board WHERE position <= 3 OR position > total - 2 OR is_current), '[]'::jsonb),
        'top_speed', COALESCE((SELECT jsonb_agg(jsonb_build_object('username', username, 'wpm', wpm,
            'difficulty', difficulty, 'rank', position, 'is_current', is_current) ORDER BY position)
            FROM best_board WHERE position <= 3 OR position > total - 2 OR is_current), '[]'::jsonb)
    );
$$;
REVOKE ALL ON FUNCTION typedash_private.leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION typedash_private.leaderboard() TO typedash_runtime;
