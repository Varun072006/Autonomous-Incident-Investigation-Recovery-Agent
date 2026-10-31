"""Configuration management for TRACEOPS backend."""
import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent


# Simple .env loader - load before Settings class definition
def load_env_file():
    # Try both backend/.env and root .env
    candidates = [BASE_DIR / ".env", BASE_DIR.parent / ".env"]
    for env_path in candidates:
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v


load_env_file()


class Settings(BaseModel):
    APP_ENV: str = os.getenv("APP_ENV", "development")
    API_HOST: str = os.getenv("API_HOST", "127.0.0.1")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", str(BASE_DIR / "traceops.db"))

    LLM_PROVIDER_ORDER: str = os.getenv("LLM_PROVIDER_ORDER", "groq,ollama,none")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
    GROQ_BASE_URL: str = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
    LLM_TIMEOUT_SECONDS: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "25"))
    LLM_TIMEOUT_S: int = int(os.getenv("LLM_TIMEOUT_SECONDS", "25"))
    LLM_CACHE: bool = os.getenv("LLM_CACHE", "true").lower() == "true"

    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")


settings = Settings()
