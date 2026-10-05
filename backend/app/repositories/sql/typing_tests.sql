CREATE TABLE IF NOT EXISTS typing_tests (
    id UUID PRIMARY KEY,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS typing_tests_created ON typing_tests(created_at);
ALTER TABLE typing_tests ENABLE ROW LEVEL SECURITY;
