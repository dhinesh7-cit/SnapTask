# main.py
import shutil
import uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException, Body, Depends, File, UploadFile, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import httpx 
import jwt 
from google.oauth2 import id_token as google_id_token_verifier
from google.auth.transport import requests as google_requests
from google.cloud import vision
from google.cloud.firestore_v1.base_query import FieldFilter
import firebase_admin
from firebase_admin import credentials, firestore as admin_firestore
import json
import os 
from dotenv import load_dotenv 

# --- 0. Load Environment Variables ---
load_dotenv() 

# --- Configuration (Fetched from Environment Variables) ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
SERVICE_ACCOUNT_KEY_PATH = os.getenv("SERVICE_ACCOUNT_KEY_PATH")

if not all([GOOGLE_CLIENT_ID, GEMINI_API_KEY, JWT_SECRET_KEY, SERVICE_ACCOUNT_KEY_PATH]):
    print("ERROR: Missing critical environment variables. Check .env file.")

GEMINI_API_URL_SCHEDULE = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
JWT_ALGORITHM = "HS256"

# --- Firebase Admin SDK Initialization ---
db = None 
if SERVICE_ACCOUNT_KEY_PATH and not firebase_admin._apps:
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred)
        db = admin_firestore.client()
        print("Firebase Admin SDK initialized successfully.")
    except Exception as e:
        print(f"Error initializing Firebase Admin SDK: {e}. Firestore disabled.")

# --- Pydantic Models (ALL DEFINED TOGETHER) ---
class UserBase(BaseModel):
    email: str
    name: Optional[str] = None
    picture_url: Optional[str] = None

class UserCreate(UserBase):
    google_id: str

class UserInDB(UserCreate):
    created_at: datetime
    last_login: datetime
    settings: Optional[Dict[str, Any]] = None
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    picture_url: Optional[str] = None

class GoogleToken(BaseModel):
    token: str

class AppToken(BaseModel):
    app_token: str
    token_type: str = "bearer"
    user_info: UserResponse

class TaskBase(BaseModel):
    description: str
    status: str = "pending"
    priority: Optional[str] = None
    due_date_suggestion: Optional[str] = None
    source_image_id: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date_suggestion: Optional[str] = None
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    calendar_event_id: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None

class TaskResponse(TaskBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    calendar_event_id: Optional[str] = None
    class Config:
        from_attributes = True

class ImageUploadResponse(BaseModel):
    message: str
    image_id: str
    file_name: str
    content_type: str

class OCRRequest(BaseModel):
    image_id: str

class OCRResponse(BaseModel):
    image_id: str
    extracted_text: str

class TaskInputForSchedule(BaseModel):
    description: str
    priority: Optional[str] = "medium"
    estimated_duration_minutes: Optional[int] = 30

class AvailabilityInput(BaseModel):
    start_time: str
    end_time: str
    date: Optional[str] = None

class AIScheduleRequest(BaseModel):
    tasks: List[TaskInputForSchedule]
    availability: AvailabilityInput

class AIScheduledTaskItem(BaseModel):
    task_description: str
    start_time: str
    end_time: str

class AIGeneratedSchedule(BaseModel):
    suggested_schedule: List[AIScheduledTaskItem]

class AIScheduleResponse(BaseModel):
    suggested_schedule: List[AIScheduledTaskItem]
    schedule_id: str

class CalendarSyncRequest(BaseModel):
    schedule_id: Optional[str] = None
    tasks_to_sync: Optional[List[AIScheduledTaskItem]] = None

class SyncedEventInfo(BaseModel):
    task_description: str
    calendar_event_id: str

class CalendarSyncResponse(BaseModel):
    message: str
    synced_events: List[SyncedEventInfo]

class DashboardSummaryResponse(BaseModel):
    name: Optional[str] = "User"
    totalTasks: int
    completedTasks: int


# --- App Initialization & Middleware ---
app = FastAPI(title="SnapTask API")
origins = [ "http://localhost", "http://127.0.0.1", "http://127.0.0.1:5500", "http://localhost:8080", "null" ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- Security and Authentication ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/google/callback") 

def create_app_jwt(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=60*24*7))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, os.getenv("JWT_SECRET_KEY"), algorithm=JWT_ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, os.getenv("JWT_SECRET_KEY"), algorithms=[JWT_ALGORITHM])
        google_id: Optional[str] = payload.get("sub")
        if not google_id: raise credentials_exception
        
        user_ref = db.collection("users").document(google_id)
        user_doc = user_ref.get()
        if not user_doc.exists: raise credentials_exception
        
        user_data = user_doc.to_dict()
        user_data['google_id'] = google_id
        if 'created_at' not in user_data: user_data['created_at'] = datetime.now(timezone.utc)
        if 'last_login' not in user_data: user_data['last_login'] = datetime.now(timezone.utc)
        
        return UserInDB(**user_data)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

# --- API Routers ---
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
tasks_router = APIRouter(prefix="/tasks", tags=["Tasks"])
images_router = APIRouter(prefix="/images", tags=["Images"])
processing_router = APIRouter(prefix="/process", tags=["Processing"])
calendar_router = APIRouter(prefix="/calendar", tags=["Calendar"])
dashboard_api_router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard API"])

# --- Endpoints ---
@auth_router.post("/google/callback", response_model=AppToken)
async def verify_google_token_and_get_app_token(token_data: GoogleToken):
    idinfo = google_id_token_verifier.verify_oauth2_token(token_data.token, google_requests.Request(), os.getenv("GOOGLE_CLIENT_ID"))
    google_id, email, name, picture = idinfo.get("sub"), idinfo.get("email"), idinfo.get("name"), idinfo.get("picture")
    if not google_id or not email: raise HTTPException(status_code=400, detail="Token missing required claims")
    user_ref = db.collection("users").document(google_id)
    user_doc = user_ref.get()
    user_for_response = UserResponse(id=google_id, email=email, name=name, picture_url=picture)
    if user_doc.exists:
        user_ref.update({"name": name, "picture_url": picture, "last_login": datetime.now(timezone.utc)})
    else:
        user_db_data = UserInDB(google_id=google_id, email=email, name=name, picture_url=picture, created_at=datetime.now(timezone.utc), last_login=datetime.now(timezone.utc), settings={"default_availability_start": "09:00", "default_availability_end": "17:00"}).model_dump()
        user_ref.set(user_db_data)
    app_jwt = create_app_jwt(data={"sub": google_id, "email": email})
    return AppToken(app_token=app_jwt, user_info=user_for_response)

@dashboard_api_router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(current_user: UserInDB = Depends(get_current_user)):
    tasks_collection_ref = db.collection("users").document(current_user.google_id).collection("tasks")
    total_tasks_count = sum(1 for _ in tasks_collection_ref.stream())
    completed_tasks_query = tasks_collection_ref.where(filter=FieldFilter("status", "==", "completed"))
    completed_tasks_count = sum(1 for _ in completed_tasks_query.stream())
    return DashboardSummaryResponse(name=current_user.name or "User", totalTasks=total_tasks_count, completedTasks=completed_tasks_count)

@tasks_router.post("/", response_model=TaskResponse)
async def create_new_task(task_data: TaskCreate, current_user: UserInDB = Depends(get_current_user)):
    user_id = current_user.google_id
    new_task_ref = db.collection("users").document(user_id).collection("tasks").document()
    task_id = new_task_ref.id
    current_time = datetime.now(timezone.utc)
    task_doc_data = TaskResponse(id=task_id, user_id=user_id, created_at=current_time, updated_at=current_time, **task_data.model_dump())
    new_task_ref.set(task_doc_data.model_dump())
    return task_doc_data

@tasks_router.get("/", response_model=List[TaskResponse])
async def get_all_tasks(current_user: UserInDB = Depends(get_current_user)):
    user_id = current_user.google_id
    tasks_stream = db.collection("users").document(user_id).collection("tasks").order_by("created_at", direction=admin_firestore.Query.DESCENDING).stream()
    return [TaskResponse(id=doc.id, user_id=user_id, **doc.to_dict()) for doc in tasks_stream]

@tasks_router.delete("/reset", status_code=204)
async def reset_all_user_tasks(current_user: UserInDB = Depends(get_current_user)):
    if not db:
        raise HTTPException(status_code=503, detail="DB unavailable")
    user_id = current_user.google_id
    tasks_ref = db.collection("users").document(user_id).collection("tasks")
    while True:
        docs = tasks_ref.limit(50).stream()
        num_deleted = 0
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
            num_deleted += 1
        if num_deleted == 0:
            break
        batch.commit()
    print(f"Reset all tasks for user {user_id}")
    return {}

@images_router.post("/upload", response_model=ImageUploadResponse)
async def upload_image_file_endpoint(image_file: UploadFile = File(...), current_user: UserInDB = Depends(get_current_user)):
    UPLOAD_DIR = Path("temp_uploaded_images")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    allowed_ct = ["image/jpeg", "image/png", "image/webp"]
    if image_file.content_type not in allowed_ct: raise HTTPException(status_code=400, detail=f"Invalid image type: {image_file.content_type}.")
    ext = os.path.splitext(image_file.filename)[1] or ".jpg"
    img_id = str(uuid.uuid4())
    local_path = UPLOAD_DIR / f"{current_user.google_id}_{img_id}{ext}"
    try:
        contents = await image_file.read()
        with open(local_path, "wb") as f_obj: f_obj.write(contents)
        img_meta_ref = db.collection("users").document(current_user.google_id).collection("images").document(img_id)
        img_meta_ref.set({"image_id": img_id, "user_id": current_user.google_id, "file_name": image_file.filename, "content_type": image_file.content_type, "uploaded_at": datetime.now(timezone.utc), "storage_path": str(local_path)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal error occurred during upload: {e}")
    finally:
        await image_file.close()
    return ImageUploadResponse(message="Image uploaded", image_id=img_id, file_name=image_file.filename, content_type=image_file.content_type)

@processing_router.post("/ai/generate_schedule", response_model=AIScheduleResponse)
async def ai_generate_schedule_endpoint(req_data: AIScheduleRequest, current_user: UserInDB = Depends(get_current_user)):
    if not GEMINI_API_KEY: raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    tasks_str_list = [f"- Description: {t.description}, Priority: {t.priority}, Duration: {t.estimated_duration_minutes} mins" for t in req_data.tasks]
    tasks_prompt_part = "\n".join(tasks_str_list)
    availability_prompt_part = f"User is available from {req_data.availability.start_time} to {req_data.availability.end_time} on {req_data.availability.date or 'today'}."
    
    # Updated prompt to ask for notes
    scheduling_prompt = f"""Given tasks:\n{tasks_prompt_part}\nAnd availability:\n{availability_prompt_part}\nCreate an optimized schedule. Also, provide a brief, helpful, and motivational "notes" string related to the schedule. Return a single JSON object with two keys: "suggested_schedule" (an array of objects) and "notes" (a string). Ensure times are ISO 8601, within availability, and consider task durations and priorities. JSON Output:"""
    
    # Updated schema to include the new "notes" field
    item_schema = AIScheduledTaskItem.model_json_schema()
    final_schema = {
        "type": "object",
        "properties": { 
            "suggested_schedule": { "type": "array", "items": item_schema },
            "notes": { "type": "string" }
        }
    }
    payload = {
        "contents": [{"parts": [{"text": scheduling_prompt}]}],
        "generationConfig": { "responseMimeType": "application/json", "responseSchema": final_schema }
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(GEMINI_API_URL_SCHEDULE, json=payload)
            resp.raise_for_status()
        result = resp.json()
        
        if (result.get("candidates") and result["candidates"][0].get("content")):
            json_text = result["candidates"][0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(json_text)
            schedule_items_data = parsed_json.get("suggested_schedule", [])
            ai_notes = parsed_json.get("notes") # Get the notes from the response
            valid_schedule_items = [AIScheduledTaskItem(**item) for item in schedule_items_data]
            
            for task_input in req_data.tasks:
                task_to_save = TaskCreate(
                    description=task_input.description,
                    priority=task_input.priority,
                    estimated_duration_minutes=task_input.estimated_duration_minutes,
                    status="pending"
                )
                await create_new_task(task_data=task_to_save, current_user=current_user)

            sched_id = str(uuid.uuid4())
            if db:
                db.collection("users").document(current_user.google_id).collection("schedules").document(sched_id).set({
                    "user_id": current_user.google_id, "tasks_input": [t.model_dump() for t in req_data.tasks],
                    "availability_input": req_data.availability.model_dump(),
                    "suggested_schedule_output": [s.model_dump() for s in valid_schedule_items],
                    "notes": ai_notes, # Save notes to the schedule document
                    "created_at": datetime.now(timezone.utc), "status": "suggested"
                })
            return AIScheduleResponse(suggested_schedule=valid_schedule_items, schedule_id=sched_id, notes=ai_notes)
        else:
            raise HTTPException(status_code=500, detail="AI model did not return valid content.")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Gemini Schedule API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during schedule generation: {e}")

# --- Include Routers ---
app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(images_router)
app.include_router(processing_router)
app.include_router(calendar_router)
app.include_router(dashboard_api_router)

@app.get("/")
async def root_endpoint(): return {"message": "Welcome to SnapTask API!"}