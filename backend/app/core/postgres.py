from app.core.config import Settings


def connection_options(settings: Settings) -> dict:
    """Runtime secrets only; compatible with Supabase transaction pooling."""
    options = {
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
