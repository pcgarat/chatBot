from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    database_url: str = "sqlite:///./chatbot.db"
    verbose: bool = False  # -v: volcar en stderr lo que se envía a Ollama (VERBOSE=1 o CHATBOT_VERBOSE=1)
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
