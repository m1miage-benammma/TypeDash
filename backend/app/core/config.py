from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, including credentials from the environment."""

    app_name: str = "TypeDash API"
    debug: bool = False
    storage: Literal["postgres", "memory"] = "postgres"
    runtime_environment: Literal["development", "production"] = "development"
    database_url: SecretStr | None = None
    db_ssl_mode: Literal["disable", "require", "verify-ca", "verify-full"] = "require"
    db_ssl_root_cert: str | None = None
    db_username: str | None = None
    db_password: SecretStr | None = None
    db_host: str | None = None
    db_port: int | None = None
    db_name: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="TYPEDASH_",
        extra="ignore",
        hide_input_in_errors=True,
    )

    @model_validator(mode="after")
    def require_postgres_environment(self):
        if self.runtime_environment == "production":
            if self.storage != "postgres":
                raise ValueError("Production requires persistent PostgreSQL storage.")
            if self.db_ssl_mode == "disable":
                raise ValueError("Production requires an encrypted database connection.")
            if self.debug:
                raise ValueError("Debug mode must be disabled in production.")
        if self.storage == "memory":
            return self
        if self.db_ssl_mode in ("verify-ca", "verify-full") and not self.db_ssl_root_cert:
            raise ValueError("TYPEDASH_DB_SSL_ROOT_CERT is required for certificate verification.")
        if self.database_url and self.database_url.get_secret_value():
            return self

        values = {
            "TYPEDASH_DB_USERNAME": self.db_username,
            "TYPEDASH_DB_PASSWORD": (
                self.db_password.get_secret_value() if self.db_password else None
            ),
            "TYPEDASH_DB_HOST": self.db_host,
            "TYPEDASH_DB_PORT": self.db_port,
            "TYPEDASH_DB_NAME": self.db_name,
        }
        missing = [name for name, value in values.items() if value in (None, "")]
        if missing:
            raise ValueError(
                "Missing PostgreSQL environment variables: " + ", ".join(missing)
            )
        return self


settings = Settings()
