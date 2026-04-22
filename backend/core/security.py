import bcrypt
import jwt as pyjwt
import secrets
import string
from datetime import datetime, timedelta
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM, REFRESH_TOKEN_EXPIRE_DAYS

def hash_password(password: str):
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str):
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def is_strong_password(password: str) -> bool:
    if len(password) < 8:
        return False

    has_letter = any(not char.isdigit() and not char.isspace() for char in password)
    has_digit = any(char.isdigit() for char in password)
    return has_letter and has_digit


def generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits

    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if is_strong_password(password):
            return password

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    return pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    
    return pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
