import secrets
from pathlib import Path


def initialize_security(database) -> str:
    sql = Path(__file__).parents[1].joinpath("repositories/sql/security.sql").read_text(encoding="utf-8")
    with database.admin_connection() as connection:
        connection.execute(sql)
        connection.execute(Path(__file__).parents[1].joinpath(
            "repositories/sql/leaderboard.sql").read_text(encoding="utf-8"))
        connection.execute(
            "INSERT INTO typedash_private.secrets(name, value) VALUES ('session-signing', %s) "
            "ON CONFLICT (name) DO NOTHING", (secrets.token_urlsafe(48),),
        )
        key = connection.execute(
            "SELECT value FROM typedash_private.secrets WHERE name = 'session-signing'"
        ).fetchone()["value"]
    with database.connection() as connection:
        role = connection.execute(
            "SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user"
        ).fetchone()
        if role["name"] != "typedash_runtime" or role["rolsuper"] or role["rolbypassrls"]:
            raise RuntimeError("The runtime database role must enforce row security.")
    return key


def maintain_security(database) -> None:
    with database.admin_connection() as connection:
        connection.execute("DELETE FROM public.typing_tests WHERE created_at < now() - interval '1 day'")
        connection.execute("DELETE FROM typedash_private.rate_limits WHERE expires_at < now()")
