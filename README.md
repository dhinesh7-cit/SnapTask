# 📸 SnapTask – AI-Powered Task Scheduler

**SnapTask** is a smart productivity web app that turns handwritten notes or whiteboard snapshots into structured task lists and intelligently scheduled plans. With Google login, OCR, and AI-driven scheduling, SnapTask simplifies your day by syncing approved tasks directly to Google Calendar.

---

## 🚀 Features

- 📷 Upload handwritten or printed task notes as images
- 🔍 Extract tasks using Google Cloud Vision OCR
- 🧠 Smart scheduling powered by Gemini AI (Google Generative AI)
- ⏰ User-defined availability for time-efficient planning
- 📅 One-click sync with Google Calendar via OAuth
- 🔐 Google Login integration
- 📦 Firebase Firestore storage
- 🎨 Clean HTML/CSS/JS frontend with FastAPI backend

---

## 🛠 Tech Stack

| Layer             | Technology                      |
|------------------|----------------------------------|
| Frontend         | HTML, CSS, JavaScript            |
| Backend API      | FastAPI (Python)                 |
| OCR              | Google Cloud Vision API          |
| AI Task Planning | Gemini API (Google Generative AI)|
| Auth             | Google OAuth 2.0                 |
| Storage          | Firebase Firestore               |
| Calendar Sync    | Google Calendar API              |

---

## 🌐 How It Works

1. User logs in using Google OAuth
2. Uploads an image of their tasks or notes
3. SnapTask uses OCR to extract raw text
4. Gemini API analyzes tasks and available time to generate a schedule
5. User reviews the schedule and approves it
6. Tasks are added to their Google Calendar

---

## 📄 License

This project is for educational and demonstration purposes.

---

## ✨ Author

Made with ❤️ by [Dhinesh E]
