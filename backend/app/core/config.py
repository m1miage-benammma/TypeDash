from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal


class Settings(BaseSettings):
    """Runtime configuration, including credentials from the environment."""

    app_name: str = "TypeDash API"
    debug: bool = False
    storage: Literal["postgres", "memory"] = "postgres"
    db_username: str = ""
    db_password: str = ""
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "typedash"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="TYPEDASH_",
        extra="ignore",
    )


settings = Settings()
