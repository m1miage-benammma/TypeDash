CREATE SCHEMA IF NOT EXISTS typedash_private;
REVOKE ALL ON SCHEMA typedash_private FROM PUBLIC;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'typedash_runtime') THEN
        CREATE ROLE typedash_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'typedash_runtime'
               AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolcanlogin)) THEN
        RAISE EXCEPTION 'typedash_runtime must be an unprivileged NOLOGIN role';
    END IF;
END $$;
GRANT typedash_runtime TO CURRENT_USER;
GRANT USAGE ON SCHEMA public, typedash_private TO typedash_runtime;

CREATE TABLE IF NOT EXISTS typedash_private.secrets (
    name TEXT PRIMARY KEY, value TEXT NOT NULL
);
REVOKE ALL ON typedash_private.secrets FROM PUBLIC, typedash_runtime;

CREATE TABLE IF NOT EXISTS typedash_private.rate_limits (
    key TEXT PRIMARY KEY, window_id BIGINT NOT NULL,
    count INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON typedash_private.rate_limits(expires_at);
GRANT SELECT, INSERT, UPDATE ON typedash_private.rate_limits TO typedash_runtime;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS owner_device_id UUID;
UPDATE public.users u SET owner_device_id = d.id FROM public.devices d
    WHERE d.user_id = u.id AND u.owner_device_id IS NULL;
ALTER TABLE public.users ALTER COLUMN owner_device_id
    SET DEFAULT NULLIF(current_setting('typedash.device_id', true), '')::uuid;
CREATE INDEX IF NOT EXISTS users_owner_device ON public.users(owner_device_id);
ALTER TABLE public.typing_tests ADD COLUMN IF NOT EXISTS owner_device_id UUID;
CREATE INDEX IF NOT EXISTS typing_tests_owner ON public.typing_tests(owner_device_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.typing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_stats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.typing_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_tests FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.users, public.devices, public.typing_stats, public.typing_tests FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.devices,
    public.typing_stats, public.typing_tests TO typedash_runtime;

DROP POLICY IF EXISTS typedash_device_owner ON public.devices;
CREATE POLICY typedash_device_owner ON public.devices TO typedash_runtime
    USING (id = NULLIF(current_setting('typedash.device_id', true), '')::uuid)
    WITH CHECK (id = NULLIF(current_setting('typedash.device_id', true), '')::uuid);
DROP POLICY IF EXISTS typedash_user_owner ON public.users;
CREATE POLICY typedash_user_owner ON public.users TO typedash_runtime
    USING (owner_device_id = NULLIF(current_setting('typedash.device_id', true), '')::uuid)
    WITH CHECK (owner_device_id = NULLIF(current_setting('typedash.device_id', true), '')::uuid);
DROP POLICY IF EXISTS typedash_stats_owner ON public.typing_stats;
CREATE POLICY typedash_stats_owner ON public.typing_stats TO typedash_runtime
    USING (device_id = NULLIF(current_setting('typedash.device_id', true), '')::uuid)
    WITH CHECK (device_id = NULLIF(current_setting('typedash.device_id', true), '')::uuid);
DROP POLICY IF EXISTS typedash_test_owner ON public.typing_tests;
CREATE POLICY typedash_test_owner ON public.typing_tests TO typedash_runtime
    USING (owner_device_id = NULLIF(current_setting('typedash.device_id', true), '')::uuid)
    WITH CHECK (owner_device_id = NULLIF(current_setting('typedash.device_id', true), '')::uuid);

-- A bounded storage ceiling also applies across devices and API workers.
CREATE OR REPLACE FUNCTION typedash_private.check_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('typedash-capacity:' || TG_TABLE_NAME, 0));
    IF TG_TABLE_NAME = 'typing_tests' THEN
        IF EXISTS (SELECT 1 FROM public.typing_tests WHERE id = NEW.id) THEN RETURN NEW; END IF;
        IF EXISTS (SELECT 1 FROM public.typing_tests OFFSET 9999 LIMIT 1) THEN
            RAISE EXCEPTION 'storage_capacity_reached' USING ERRCODE = 'P0001';
        END IF;
    ELSIF TG_TABLE_NAME = 'typing_stats' THEN
        IF EXISTS (SELECT 1 FROM public.typing_stats WHERE source_test_id = NEW.source_test_id) THEN RETURN NEW; END IF;
        IF EXISTS (SELECT 1 FROM public.typing_stats OFFSET 99999 LIMIT 1) THEN
            RAISE EXCEPTION 'storage_capacity_reached' USING ERRCODE = 'P0001';
        END IF;
    ELSIF TG_TABLE_NAME = 'devices' THEN
        IF EXISTS (SELECT 1 FROM public.devices WHERE id = NEW.id) THEN RETURN NEW; END IF;
        IF EXISTS (SELECT 1 FROM public.devices OFFSET 9999 LIMIT 1) THEN
            RAISE EXCEPTION 'storage_capacity_reached' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION typedash_private.check_capacity() FROM PUBLIC;
DROP TRIGGER IF EXISTS typedash_capacity ON public.typing_tests;
CREATE TRIGGER typedash_capacity BEFORE INSERT ON public.typing_tests
    FOR EACH ROW EXECUTE FUNCTION typedash_private.check_capacity();
DROP TRIGGER IF EXISTS typedash_capacity ON public.typing_stats;
CREATE TRIGGER typedash_capacity BEFORE INSERT ON public.typing_stats
    FOR EACH ROW EXECUTE FUNCTION typedash_private.check_capacity();
DROP TRIGGER IF EXISTS typedash_capacity ON public.devices;
CREATE TRIGGER typedash_capacity BEFORE INSERT ON public.devices
    FOR EACH ROW EXECUTE FUNCTION typedash_private.check_capacity();
