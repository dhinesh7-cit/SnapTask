# main.py
import os
import datetime
import uuid
import json
from typing import List, Optional, Dict, Any

# --- FastAPI and Related Imports ---
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# --- Pydantic for Data Modeling ---
from pydantic import BaseModel, Field

# --- Security (JWT) Imports ---
from jose import JWTError, jwt

# --- Environment and Google API Imports ---
from dotenv import load_dotenv
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
import google.generativeai as genai

# --- Firebase Admin SDK Imports ---
import firebase_admin
from firebase_admin import credentials, firestore

# --- Debugging and Logging ---
import traceback

# ===============================================================================
# 1. INITIAL SETUP & CONFIGURATION
# ===============================================================================

load_dotenv()

# --- Environment Variables ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
FIREBASE_SERVICE_ACCOUNT_KEY_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")

# --- Configure Gemini AI ---
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY not found. AI features will be disabled.")

# --- Firebase Admin SDK Initialization ---
if not FIREBASE_SERVICE_ACCOUNT_KEY_PATH or not os.path.exists(FIREBASE_SERVICE_ACCOUNT_KEY_PATH):
    raise ValueError("Firebase service account key path not found or invalid.")
cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_KEY_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

# --- FastAPI App Initialization ---
app = FastAPI(title="SnapTask API with Firebase")

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security Setup ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/google/callback")

# ===============================================================================
# 2. PYDANTIC SCHEMAS (Data Transfer Objects)
# ===============================================================================
# NOTE: orm_mode is removed as we are not using an ORM anymore.

# --- User Schemas ---
class UserSchema(BaseModel):
    email: str
    name: str
    picture_url: Optional[str] = None

# --- Token Schemas ---
class GoogleToken(BaseModel):
    token: str

class TokenData(BaseModel):
    email: Optional[str] = None

# --- Task Schemas ---
class TaskBase(BaseModel):
    description: str
    priority: str = "medium"
    estimated_duration_minutes: int = 30

class TaskCreate(TaskBase):
    pass

class TaskSchema(TaskBase):
    id: str # Document ID from Firestore
    status: str
    owner_email: str

# --- AI & Schedule Schemas ---
class Availability(BaseModel):
    start_time: str
    end_time: str

class ScheduleRequest(BaseModel):
    tasks: List[TaskCreate]
    availability: Availability

class ScheduledTask(BaseModel):
    task_description: str
    start_time: str
    end_time: str

class AIScheduleResponse(BaseModel):
    schedule_id: str
    suggested_schedule: List[ScheduledTask]
    notes: str

# ===============================================================================
# 3. SECURITY & AUTHENTICATION
# ===============================================================================

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (expires_delta or datetime.timedelta(days=1))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("email")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user_doc_ref = db.collection('users').document(email)
    user_doc = user_doc_ref.get()
    if not user_doc.exists:
        raise credentials_exception
    return user_doc.to_dict()

# ===============================================================================
# 4. API ENDPOINTS
# ===============================================================================

# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"[ERROR] Unhandled Exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# --- Health Check Endpoint ---
@app.get("/healthz", include_in_schema=False)
async def health_check():
    return {"status": "ok"}

# --- Authentication Endpoint ---
@app.post("/auth/google/callback", tags=["Authentication"])
async def google_auth_callback(google_token: GoogleToken):
    print("[DEBUG] /auth/google/callback called")
    try:
        if not GOOGLE_CLIENT_ID:
            print("[ERROR] GOOGLE_CLIENT_ID is missing")
            raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID is not set on the backend.")
        print(f"[DEBUG] Received token: {google_token.token[:20]}...")
        idinfo = google_id_token.verify_oauth2_token(
            google_token.token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        print(f"[DEBUG] Google ID token verified: {idinfo}")
        email = idinfo['email']
        user_doc_ref = db.collection('users').document(email)
        user_doc = user_doc_ref.get()
        if not user_doc.exists:
            user_data = {
                "email": email,
                "name": idinfo.get('name', 'New User'),
                "picture_url": idinfo.get('picture'),
                "created_at": firestore.SERVER_TIMESTAMP
            }
            user_doc_ref.set(user_data)
            print(f"[DEBUG] New user created: {user_data}")
        app_token = create_access_token(data={"email": email})
        print(f"[DEBUG] App token created for {email}")
        return {
            "app_token": app_token,
            "user_info": {
                "name": idinfo.get('name'),
                "email": email,
                "picture_url": idinfo.get('picture')
            }
        }
    except ValueError as e:
        print(f"[ERROR] Invalid Google token: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid Google token: {e}")
    except Exception as e:
        print(f"[ERROR] Exception in /auth/google/callback: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

# --- Dashboard Endpoint ---
@app.get("/api/v1/dashboard/summary", tags=["Dashboard"])
async def get_dashboard_summary(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_email = current_user['email']
    tasks_ref = db.collection('tasks').where('owner_email', '==', user_email).stream()
    
    total_tasks = 0
    completed_tasks = 0
    for task in tasks_ref:
        total_tasks += 1
        if task.to_dict().get('status') == 'completed':
            completed_tasks += 1
    
    return {"totalTasks": total_tasks, "completedTasks": completed_tasks}

# --- Tasks Endpoints ---
@app.get("/tasks/", response_model=List[TaskSchema], tags=["Tasks"])
async def read_tasks(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_email = current_user['email']
    tasks_stream = db.collection('tasks').where('owner_email', '==', user_email).stream()
    
    tasks_list = []
    for task in tasks_stream:
        task_data = task.to_dict()
        task_data['id'] = task.id # Add the document ID to the data
        tasks_list.append(task_data)
        
    return tasks_list

@app.delete("/tasks/reset", status_code=status.HTTP_204_NO_CONTENT, tags=["Tasks"])
async def reset_tasks(current_user: Dict[str, Any] = Depends(get_current_user)):
    user_email = current_user['email']
    tasks_query = db.collection('tasks').where('owner_email', '==', user_email)
    tasks_docs = tasks_query.stream()

    batch = db.batch()
    doc_count = 0
    for doc in tasks_docs:
        batch.delete(doc.reference)
        doc_count += 1
    
    if doc_count > 0:
        batch.commit()
    
    return {"message": f"{doc_count} tasks have been reset."}
    
# --- AI Processing Endpoint ---
@app.post("/process/ai/generate_schedule", response_model=AIScheduleResponse, tags=["AI Processing"])
async def generate_ai_schedule(
    schedule_request: ScheduleRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    if not GEMINI_API_KEY or not genai:
        raise HTTPException(status_code=503, detail="AI Service is not configured or available.")

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        As an expert scheduler, create a schedule based on the provided JSON data. Today is {datetime.date.today().isoformat()}.
        Constraints: Available from {schedule_request.availability.start_time} to {schedule_request.availability.end_time}. If there are high priority tasks, schedule them first. If there are no high priority tasks, schedule medium and low priority tasks as best as possible. Add breaks if time allows. Do not skip tasks just because they are not high priority.
        Input Tasks: {json.dumps([task.dict() for task in schedule_request.tasks])}
        Provide the output as a single, valid JSON object with keys \"suggested_schedule\" (array of objects with \"task_description\", \"start_time\", \"end_time\" in ISO 8601 format) and \"notes\" (a brief message).
        """
        response = await model.generate_content_async(prompt)
        cleaned_response_text = response.text.strip().replace("```json", "").replace("```", "")
        ai_data = json.loads(cleaned_response_text)
        
        # Use a batch to save all new tasks to Firestore
        batch = db.batch()
        tasks_collection_ref = db.collection('tasks')
        
        for scheduled_item in ai_data.get("suggested_schedule", []):
            task_doc_ref = tasks_collection_ref.document() # Auto-generate ID
            batch.set(task_doc_ref, {
                "description": scheduled_item["task_description"],
                "status": "pending",
                "priority": "medium", # Default priority, can be improved
                "owner_email": current_user['email'],
                "created_at": firestore.SERVER_TIMESTAMP
            })
        batch.commit()

        return AIScheduleResponse(
            schedule_id=str(uuid.uuid4()),
            suggested_schedule=ai_data.get("suggested_schedule", []),
            notes=ai_data.get("notes", "Schedule generated.")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate AI schedule: {e}")

# --- Static File Serving ---
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", include_in_schema=False)
async def read_root():
    return FileResponse('static/login.html')

@app.get("/{page_name}.html", include_in_schema=False)
async def read_page(page_name: str):
    file_path = f'static/{page_name}.html'
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Page not found")

# --- Main entry point to run the app ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
