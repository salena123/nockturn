import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)