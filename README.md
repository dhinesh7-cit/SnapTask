# 📸 SnapTask – AI-Powered Task Scheduler

**SnapTask** is a smart productivity web app that turns handwritten notes, whiteboard snapshots, PDFs, and DOCX files into structured task lists and intelligently scheduled plans. With Google login, Gemini OCR, and AI-driven scheduling, SnapTask simplifies your day by helping you manage your tasks efficiently.

---

## 🚀 Features

- 📷 Upload handwritten or printed task notes as images
- 🔍 Extract tasks using Gemini API's built-in OCR
- 📄 PDF and DOCX file support for task extraction
- 🧠 Smart scheduling powered by Gemini AI (Google Generative AI)
- ⏰ User-defined availability for time-efficient planning
- ✨ Clean HTML/CSS/JS frontend with FastAPI backend
- 🔐 Google Login integration
- 📦 Firebase Firestore storage
- 🔔 (Upcoming) Task reminders via ServiceWorker notifications

---

## 🛠 Tech Stack

| Layer             | Technology                      |
|------------------|----------------------------------|
| Frontend         | HTML, CSS, JavaScript            |
| Backend API      | FastAPI (Python)                 |
| OCR              | Gemini API (OCR + AI)            |
| AI Task Planning | Gemini API (Google Generative AI)|
| Auth             | Google OAuth 2.0                 |
| Storage          | Firebase Firestore               |
| Notifications    | (Planned) ServiceWorker API      |

---

## 🌐 How It Works

1. User logs in using Google OAuth
2. Uploads an image, PDF, or DOCX file of their tasks or notes
3. SnapTask uses Gemini API to extract raw text via OCR
4. Gemini analyzes tasks and available time to generate a schedule
5. User reviews the schedule and approves it
6. SnapTask displays the structured plan to the user

---

## 📄 License

This project is for educational and demonstration purposes.

---

## ✨ Author

Made with ❤️ by [Dhinesh E]
