from fastapi import FastAPI, APIRouter, HTTPException, Depends, Form, File, UploadFile, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import json
from urllib.parse import unquote
import secrets
from email_validator import validate_email, EmailNotValidError
from collections import defaultdict
import pyotp
import qrcode
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Security - Use SHA256 instead of bcrypt to avoid password length issues
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get("SECRET_KEY", "filedrop-secure-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create upload directories (relative to server root, configurable via env)
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", ROOT_DIR / "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Create the main app
app = FastAPI(title="FileDrop API", description="Zero Trust Secure File Sharing")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Root endpoint for API
@api_router.get("/")
async def root():
    return {"message": "FileDrop API v1.0", "status": "healthy"}

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    two_fa_enabled: bool = False
    two_fa_secret: Optional[str] = None
    phone_number: Optional[str] = None

class TwoFASetup(BaseModel):
    method: str  # "app" or "sms"
    phone_number: Optional[str] = None

class TwoFAVerify(BaseModel):
    code: str
    method: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User
    requires_2fa: bool = False

class FileShare(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_filename: str
    uploader_id: str
    encrypted_key_blob: str  # Password-encrypted AES key
    share_link: str
    expires_at: Optional[datetime] = None
    download_limit: Optional[int] = None
    download_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    file_size: int
    file_type: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class FileShareCreate(BaseModel):
    original_filename: str
    encrypted_key_blob: str
    password_hint: Optional[str] = None
    expires_hours: Optional[int] = 24
    download_limit: Optional[int] = None

class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    details: Optional[dict] = None
    success: bool = True

class AnalyticsData(BaseModel):
    total_files: int
    total_downloads: int
    total_users: int
    files_this_week: int
    downloads_this_week: int
    storage_used: int
    top_file_types: List[Dict[str, Any]]
    daily_activity: List[Dict[str, Any]]
    recent_activities: List[Dict[str, Any]]

# Utility Functions
def verify_password(plain_password, hashed_password):
    # Truncate password to 72 bytes for bcrypt compatibility
    if len(plain_password.encode('utf-8')) > 72:
        plain_password = plain_password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    # Truncate password to 72 bytes for bcrypt compatibility
    if len(password.encode('utf-8')) > 72:
        password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    return User(**user)

async def log_audit_event(action: str, resource_type: str, user_id: str = None, resource_id: str = None, details: dict = None, success: bool = True, ip_address: str = None, user_agent: str = None):
    """Log audit events for compliance and analytics"""
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        success=success,
        ip_address=ip_address,
        user_agent=user_agent
    )
    await db.audit_logs.insert_one(audit_log.dict())

def generate_secure_link():
    """Generate cryptographically secure sharing link"""
    return secrets.token_urlsafe(32)

def generate_2fa_secret():
    """Generate 2FA secret for TOTP"""
    return pyotp.random_base32()

def generate_qr_code(user_email: str, secret: str):
    """Generate QR code for 2FA setup"""
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user_email,
        issuer_name="FileDrop"
    )
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def verify_2fa_code(secret: str, code: str) -> bool:
    """Verify 2FA TOTP code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=2)  # Allow 2 windows for clock skew

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    user_dict["id"] = str(uuid.uuid4())
    user_dict["created_at"] = datetime.now(timezone.utc)
    user_dict["is_active"] = True
    user_dict["two_fa_enabled"] = False
    user_dict["two_fa_secret"] = None
    user_dict["phone_number"] = None
    
    await db.users.insert_one(user_dict)
    
    # Log registration
    await log_audit_event("USER_REGISTERED", "user", user_dict["id"])
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    user_obj = User(**{k: v for k, v in user_dict.items() if k != "password"})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj,
        "requires_2fa": False
    }

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    # Find user
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        await log_audit_event("LOGIN_FAILED", "auth", details={"email": user.email}, success=False)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # Check if 2FA is enabled
    if db_user.get("two_fa_enabled", False):
        # Return special token that requires 2FA
        temp_token = create_access_token(
            data={"sub": user.email, "requires_2fa": True}, 
            expires_delta=timedelta(minutes=5)
        )
        
        return {
            "access_token": temp_token,
            "token_type": "bearer",
            "user": User(**{k: v for k, v in db_user.items() if k != "password"}),
            "requires_2fa": True
        }
    
    # Log successful login
    await log_audit_event("USER_LOGIN", "auth", db_user["id"])
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    user_obj = User(**{k: v for k, v in db_user.items() if k != "password"})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_obj,
        "requires_2fa": False
    }

# 2FA Routes
@api_router.post("/auth/2fa/setup")
async def setup_2fa(setup_data: TwoFASetup, current_user: User = Depends(get_current_user)):
    if setup_data.method == "app":
        # Generate secret and QR code for authenticator app
        secret = generate_2fa_secret()
        qr_code = generate_qr_code(current_user.email, secret)
        
        # Store secret temporarily (user needs to verify before enabling)
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"two_fa_secret_temp": secret}}
        )
        
        return {
            "method": "app",
            "secret": secret,
            "qr_code": qr_code,
            "message": "Scan the QR code with your authenticator app and verify with a code"
        }
    
    elif setup_data.method == "sms":
        if not setup_data.phone_number:
            raise HTTPException(status_code=400, detail="Phone number required for SMS 2FA")
        
        # Store phone number temporarily
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"phone_number_temp": setup_data.phone_number}}
        )
        
        # In production, send SMS here
        # For demo, we'll use a fixed code
        return {
            "method": "sms",
            "phone_number": setup_data.phone_number,
            "message": "SMS 2FA setup initiated. For demo purposes, use code: 123456"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid 2FA method")

@api_router.post("/auth/2fa/verify")
async def verify_2fa_setup(verify_data: TwoFAVerify, current_user: User = Depends(get_current_user)):
    user_data = await db.users.find_one({"id": current_user.id})
    
    if verify_data.method == "app":
        secret = user_data.get("two_fa_secret_temp")
        if not secret:
            raise HTTPException(status_code=400, detail="No 2FA setup in progress")
        
        if not verify_2fa_code(secret, verify_data.code):
            raise HTTPException(status_code=400, detail="Invalid verification code")
        
        # Enable 2FA
        await db.users.update_one(
            {"id": current_user.id},
            {
                "$set": {
                    "two_fa_enabled": True,
                    "two_fa_secret": secret
                },
                "$unset": {"two_fa_secret_temp": ""}
            }
        )
        
        await log_audit_event("2FA_ENABLED", "auth", current_user.id, details={"method": "app"})
        
        return {"message": "2FA enabled successfully"}
    
    elif verify_data.method == "sms":
        # For demo, accept 123456
        if verify_data.code != "123456":
            raise HTTPException(status_code=400, detail="Invalid verification code")
        
        phone_number = user_data.get("phone_number_temp")
        if not phone_number:
            raise HTTPException(status_code=400, detail="No SMS 2FA setup in progress")
        
        # Enable SMS 2FA
        await db.users.update_one(
            {"id": current_user.id},
            {
                "$set": {
                    "two_fa_enabled": True,
                    "phone_number": phone_number
                },
                "$unset": {"phone_number_temp": ""}
            }
        )
        
        await log_audit_event("2FA_ENABLED", "auth", current_user.id, details={"method": "sms"})
        
        return {"message": "SMS 2FA enabled successfully"}

@api_router.post("/auth/2fa/login")
async def complete_2fa_login(verify_data: TwoFAVerify, credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        requires_2fa = payload.get("requires_2fa", False)
        
        if not requires_2fa:
            raise HTTPException(status_code=400, detail="2FA not required for this session")
        
        user_data = await db.users.find_one({"email": email})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify 2FA code
        if verify_data.method == "app":
            secret = user_data.get("two_fa_secret")
            if not secret or not verify_2fa_code(secret, verify_data.code):
                await log_audit_event("2FA_FAILED", "auth", user_data["id"], success=False)
                raise HTTPException(status_code=400, detail="Invalid 2FA code")
        
        elif verify_data.method == "sms":
            # For demo, accept 123456
            if verify_data.code != "123456":
                await log_audit_event("2FA_FAILED", "auth", user_data["id"], success=False)
                raise HTTPException(status_code=400, detail="Invalid SMS code")
        
        # Log successful login
        await log_audit_event("2FA_LOGIN_SUCCESS", "auth", user_data["id"])
        
        # Create full access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": email}, expires_delta=access_token_expires
        )
        
        user_obj = User(**{k: v for k, v in user_data.items() if k != "password"})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_obj,
            "requires_2fa": False
        }
        
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.post("/auth/2fa/disable")
async def disable_2fa(current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user.id},
        {
            "$set": {"two_fa_enabled": False},
            "$unset": {"two_fa_secret": "", "phone_number": ""}
        }
    )
    
    await log_audit_event("2FA_DISABLED", "auth", current_user.id)
    
    return {"message": "2FA disabled successfully"}

# File Sharing Routes
@api_router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    metadata: str = Form(...),  # JSON string with FileShareCreate data
    current_user: User = Depends(get_current_user)
):
    try:
        # Parse metadata
        file_metadata = json.loads(metadata)
        share_data = FileShareCreate(**file_metadata)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=400, detail="Invalid metadata format")
    
    # Generate secure filename and share link
    file_extension = Path(file.filename).suffix
    secure_filename = f"{uuid.uuid4()}{file_extension}"
    share_link = generate_secure_link()
    
    # Save encrypted file
    file_path = UPLOAD_DIR / secure_filename
    content = await file.read()
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Calculate expiry
    expires_at = None
    if share_data.expires_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=share_data.expires_hours)
    
    # Determine file type
    file_type = file_extension.lower() if file_extension else 'unknown'
    
    # Create file share record
    file_share = FileShare(
        filename=secure_filename,
        original_filename=share_data.original_filename,
        uploader_id=current_user.id,
        encrypted_key_blob=share_data.encrypted_key_blob,
        share_link=share_link,
        expires_at=expires_at,
        download_limit=share_data.download_limit,
        file_size=len(content),
        file_type=file_type
    )
    
    await db.file_shares.insert_one(file_share.dict())
    
    # Log file upload
    await log_audit_event(
        "FILE_UPLOADED", 
        "file", 
        current_user.id, 
        file_share.id,
        {
            "filename": share_data.original_filename, 
            "size": len(content),
            "file_type": file_type
        }
    )
    
    return {
        "share_link": share_link,
        "file_id": file_share.id,
        "expires_at": expires_at,
        "download_limit": share_data.download_limit
    }

@api_router.get("/files/share/{share_link}")
async def get_share_info(share_link: str):
    """Get information about a shared file without downloading"""
    file_share = await db.file_shares.find_one({"share_link": share_link})
    if not file_share:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if expired
    if file_share["expires_at"]:
        expires_at = file_share["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="File link has expired")
    
    # Check download limit
    if (file_share["download_limit"] and 
        file_share["download_count"] >= file_share["download_limit"]):
        raise HTTPException(status_code=410, detail="Download limit exceeded")
    
    return {
        "original_filename": file_share["original_filename"],
        "file_size": file_share["file_size"],
        "expires_at": file_share["expires_at"],
        "download_limit": file_share["download_limit"],
        "download_count": file_share["download_count"]
    }

@api_router.get("/files/download/{share_link}")
async def download_file(share_link: str):
    """Download encrypted file and key blob"""
    file_share = await db.file_shares.find_one({"share_link": share_link})
    if not file_share:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check if expired
    if file_share["expires_at"]:
        expires_at = file_share["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=410, detail="File link has expired")
    
    # Check download limit
    if (file_share["download_limit"] and 
        file_share["download_count"] >= file_share["download_limit"]):
        raise HTTPException(status_code=410, detail="Download limit exceeded")
    
    # Increment download count
    await db.file_shares.update_one(
        {"share_link": share_link},
        {"$inc": {"download_count": 1}}
    )
    
    # Log download
    await log_audit_event(
        "FILE_DOWNLOADED", 
        "file", 
        None, 
        file_share["id"],
        {"filename": file_share["original_filename"]}
    )
    
    file_path = UPLOAD_DIR / file_share["filename"]
    
    return {
        "encrypted_key_blob": file_share["encrypted_key_blob"],
        "filename": file_share["original_filename"],
        "file_url": f"/api/files/raw/{share_link}"
    }

@api_router.get("/files/raw/{share_link}")
async def get_raw_file(share_link: str):
    """Stream the raw encrypted file"""
    file_share = await db.file_shares.find_one({"share_link": share_link})
    if not file_share:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = UPLOAD_DIR / file_share["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(file_path, filename=file_share["original_filename"])

@api_router.get("/files/my-files")
async def get_my_files(current_user: User = Depends(get_current_user)):
    """Get all files uploaded by current user"""
    files = await db.file_shares.find({"uploader_id": current_user.id}).to_list(1000)
    
    # Convert ObjectId to string and handle datetime serialization
    result = []
    for f in files:
        file_dict = {}
        for k, v in f.items():
            if k == "encrypted_key_blob":
                continue  # Skip encrypted key blob
            elif k == "_id":
                file_dict["id"] = str(v)  # Convert ObjectId to string
            elif isinstance(v, datetime):
                file_dict[k] = v.isoformat() if v else None  # Convert datetime to ISO string
            else:
                file_dict[k] = v
        result.append(file_dict)
    
    return result

# Analytics Routes
@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard(current_user: User = Depends(get_current_user)):
    """Get analytics dashboard data"""
    
    # Calculate date ranges
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    # Basic statistics
    total_files = await db.file_shares.count_documents({"uploader_id": current_user.id})
    
    # Total downloads for user's files
    user_files = await db.file_shares.find({"uploader_id": current_user.id}).to_list(1000)
    total_downloads = sum(f.get("download_count", 0) for f in user_files)
    
    # Files uploaded this week
    files_this_week = await db.file_shares.count_documents({
        "uploader_id": current_user.id,
        "created_at": {"$gte": week_ago}
    })
    
    # Downloads this week (from audit logs)
    downloads_this_week_logs = await db.audit_logs.count_documents({
        "action": "FILE_DOWNLOADED",
        "timestamp": {"$gte": week_ago},
        "resource_id": {"$in": [f["id"] for f in user_files]}
    })
    
    # Calculate storage used
    storage_used = sum(f.get("file_size", 0) for f in user_files)
    
    # Top file types
    file_type_counts = defaultdict(int)
    file_type_sizes = defaultdict(int)
    
    for file in user_files:
        file_type = file.get("file_type", "unknown").replace(".", "").lower()
        if not file_type:
            file_type = "unknown"
        file_type_counts[file_type] += 1
        file_type_sizes[file_type] += file.get("file_size", 0)
    
    top_file_types = [
        {
            "type": file_type,
            "count": count,
            "size": file_type_sizes[file_type]
        }
        for file_type, count in sorted(file_type_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    # Daily activity for the last 7 days
    daily_activity = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        files_count = await db.file_shares.count_documents({
            "uploader_id": current_user.id,
            "created_at": {"$gte": day_start, "$lt": day_end}
        })
        
        downloads_count = await db.audit_logs.count_documents({
            "action": "FILE_DOWNLOADED",
            "timestamp": {"$gte": day_start, "$lt": day_end},
            "resource_id": {"$in": [f["id"] for f in user_files]}
        })
        
        daily_activity.append({
            "date": day_start.isoformat(),
            "uploads": files_count,
            "downloads": downloads_count
        })
    
    daily_activity.reverse()  # Oldest first
    
    # Recent activities
    recent_logs = await db.audit_logs.find({
        "$or": [
            {"user_id": current_user.id},
            {"resource_id": {"$in": [f["id"] for f in user_files]}}
        ]
    }).sort("timestamp", -1).limit(10).to_list(10)
    
    recent_activities = [
        {
            "action": log["action"],
            "timestamp": log["timestamp"].isoformat(),
            "details": log.get("details", {}),
            "success": log.get("success", True)
        }
        for log in recent_logs
    ]
    
    return AnalyticsData(
        total_files=total_files,
        total_downloads=total_downloads,
        total_users=1,  # Individual user dashboard
        files_this_week=files_this_week,
        downloads_this_week=downloads_this_week_logs,
        storage_used=storage_used,
        top_file_types=top_file_types,
        daily_activity=daily_activity,
        recent_activities=recent_activities
    )

@api_router.get("/analytics/admin")
async def get_admin_analytics(current_user: User = Depends(get_current_user)):
    """Get admin analytics (for future admin role implementation)"""
    
    # For now, return global statistics
    total_files = await db.file_shares.count_documents({})
    total_users = await db.users.count_documents({})
    
    # Total downloads across all files
    all_files = await db.file_shares.find({}).to_list(10000)
    total_downloads = sum(f.get("download_count", 0) for f in all_files)
    
    # Calculate date ranges
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    files_this_week = await db.file_shares.count_documents({
        "created_at": {"$gte": week_ago}
    })
    
    downloads_this_week = await db.audit_logs.count_documents({
        "action": "FILE_DOWNLOADED",
        "timestamp": {"$gte": week_ago}
    })
    
    storage_used = sum(f.get("file_size", 0) for f in all_files)
    
    # Global file types
    file_type_counts = defaultdict(int)
    for file in all_files:
        file_type = file.get("file_type", "unknown").replace(".", "").lower()
        if not file_type:
            file_type = "unknown"
        file_type_counts[file_type] += 1
    
    top_file_types = [
        {"type": ft, "count": count}
        for ft, count in sorted(file_type_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    return {
        "total_files": total_files,
        "total_downloads": total_downloads,
        "total_users": total_users,
        "files_this_week": files_this_week,
        "downloads_this_week": downloads_this_week,
        "storage_used": storage_used,
        "top_file_types": top_file_types
    }

@api_router.get("/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """Get recent audit logs (user's own logs for compliance)"""
    user_files = await db.file_shares.find({"uploader_id": current_user.id}).to_list(1000)
    
    logs = await db.audit_logs.find({
        "$or": [
            {"user_id": current_user.id},
            {"resource_id": {"$in": [f["id"] for f in user_files]}}
        ]
    }).sort("timestamp", -1).limit(limit).to_list(limit)
    
    formatted_logs = []
    for log in logs:
        log_dict = {}
        for k, v in log.items():
            if k == "_id":
                log_dict["id"] = str(v)
            elif isinstance(v, datetime):
                log_dict[k] = v.isoformat() if v else None
            else:
                log_dict[k] = v
        formatted_logs.append(log_dict)
    
    return formatted_logs

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "FileDrop API"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("server:app", host=host, port=port, reload=True)
