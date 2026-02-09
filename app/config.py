from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    database_url: str = "sqlite:///./chatbot.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
