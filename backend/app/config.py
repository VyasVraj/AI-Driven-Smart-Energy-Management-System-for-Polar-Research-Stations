from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    SECRET_KEY: str = "polaris-energy-ai-secret-key-for-sih-2026-demo"
    DATABASE_URL: str = "sqlite:///./polaris.db"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    DEMO_MODE: bool = True
    DEBUG: bool = True
    APP_NAME: str = "POLARIS ENERGY AI"
    VERSION: str = "1.0.0"
    
    class Config:
        env_file = ".env"

settings = Settings()
