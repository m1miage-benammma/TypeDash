CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(24) NOT NULL,
    username_key VARCHAR(24) NOT NULL UNIQUE,
    username_changes SMALLINT NOT NULL DEFAULT 0
        CHECK (username_changes BETWEEN 0 AND 3),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username_changes
    SMALLINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS typing_stats (
    id UUID PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    source_test_id UUID NOT NULL UNIQUE,
    difficulty VARCHAR(16) NOT NULL
        CHECK (difficulty IN ('easy', 'medium', 'hard')),
    language VARCHAR(2) NOT NULL CHECK (language IN ('en', 'fr')),
    duration_seconds SMALLINT NOT NULL
        CHECK (duration_seconds BETWEEN 1 AND 300),
    punctuation BOOLEAN NOT NULL,
    numbers BOOLEAN NOT NULL,
    wpm NUMERIC(7, 2) NOT NULL CHECK (wpm >= 0),
    accuracy NUMERIC(5, 2) NOT NULL
        CHECK (accuracy BETWEEN 0 AND 100),
    correct_characters INTEGER NOT NULL
        CHECK (correct_characters >= 0),
    incorrect_characters INTEGER NOT NULL
        CHECK (incorrect_characters >= 0),
    typed_characters INTEGER NOT NULL
        CHECK (typed_characters >= 0),
    completed_words INTEGER NOT NULL CHECK (completed_words >= 0),
    elapsed_seconds NUMERIC(8, 2) NOT NULL
        CHECK (elapsed_seconds >= 0),
    finished_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE typing_stats ADD COLUMN IF NOT EXISTS
    samples JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

ALTER TABLE typing_stats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS typing_stats_device_finished_id ON typing_stats(device_id, finished_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS devices_user_id ON devices(user_id);
