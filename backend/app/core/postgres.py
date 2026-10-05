from app.core.config import Settings


def connection_options(settings: Settings) -> dict:
    """Runtime secrets only; compatible with Supabase transaction pooling."""
    from psycopg.rows import dict_row

    options = {
        "row_factory": dict_row,
        "sslmode": settings.db_ssl_mode,
        "connect_timeout": 10,
        "prepare_threshold": None,
    }
    if settings.db_ssl_root_cert:
        options["sslrootcert"] = settings.db_ssl_root_cert
    if settings.database_url:
        options["conninfo"] = settings.database_url.get_secret_value()
    else:
        options.update(
            host=settings.db_host, port=settings.db_port, dbname=settings.db_name,
            user=settings.db_username, password=settings.db_password.get_secret_value(),
        )
    return options


class PostgresDatabase:
    def __init__(self, settings: Settings):
        from psycopg_pool import ConnectionPool

        options = connection_options(settings)
        conninfo = options.pop("conninfo", "")
        self.pool = ConnectionPool(
            conninfo=conninfo, kwargs=options, min_size=1, max_size=4,
            timeout=10, max_waiting=32, open=False,
            check=ConnectionPool.check_connection,
        )

    def open(self) -> None:
        self.pool.open(wait=True, timeout=15)

    def connection(self):
        return self.pool.connection()

    def close(self) -> None:
        self.pool.close()
