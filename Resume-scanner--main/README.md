🚀 ResumeAIX: AI-Powered ATS Scanner & Job Matcher
ResumeAIX is a full-stack, AI-driven web application designed to help job seekers bypass modern Applicant Tracking Systems (ATS). By leveraging Google's Gemini 2.5 Flash LLM and real-time job APIs, the platform instantly analyzes uploaded resumes, calculates an ATS match score, identifies critical skill gaps, and provides live, clickable job matches tailored to the candidate's profile.

✨ New in v2.0 (Production Update)
User Authentication: Secure JWT-based login and registration system backed by MongoDB.

Protected Dashboards: Private resume analysis workflow locked behind user authentication.

Multi-Page Routing: Seamless navigation with React Router (Home, About, Contact, Dashboard).

3D Glassmorphic UI: Premium dark-mode interface featuring a live, interactive 3D background powered by React Three Fiber.

🏗️ System Architecture & Data Flow
Below is the end-to-end data pipeline representing the core workflow:

Plaintext
  [ User ]
     │
     ▼  (1. Register / Login)
  [ MongoDB (Users) ]
     │
     ▼  (2. JWT Token Granted -> Redirect to /dashboard)
  ┌───────────────────────────┐
  │     React Frontend        │  <-- Renders 3D Background & Dropzone
  └─────────────┬─────────────┘
                │  (3. POST /analyze + JWT Token)
                ▼
  ┌───────────────────────────┐
  │     FastAPI Backend       │  <-- Extracts text via pdfminer.six
  └─────────┬───────┬─────────┘
            │       │
            ▼       ▼  (4. Send Text + System Prompt)
  ┌───────────────────────────┐
  │  Google Gemini 2.5 Flash  │  <-- Predicts Role, ATS Score, & Missing Skills
  └─────────────┬─────────────┘
                │  (5. Return JSON payload)
                ▼
  ┌───────────────────────────┐
  │     Python Controller     │
  └─────────┬───────┬─────────┘
            │       │
            ▼       ▼  (6. Query Live Job Database based on AI Prediction)
  ┌───────────────────────────┐
  │       Remotive API        │  <-- Fetches 3 live remote jobs
  └─────────────┬─────────────┘
                │
                ▼  (7. Send final aggregate data back to client)
  ┌───────────────────────────┐
  │     React Frontend        │  <-- Renders Circular ATS Loader & Job Cards
  └───────────────────────────┘
💻 Tech Stack
Frontend: React.js, React Router, Custom CSS3, Axios, @react-three/fiber (3D Animations)

Backend: Python, FastAPI, Uvicorn

Authentication: JWT (JSON Web Tokens), passlib, bcrypt

Database: MongoDB, PyMongo

AI & NLP: google-generativeai (Gemini 2.5 Flash), pdfminer.six

External Integrations: Remotive API

⚙️ Local Setup & Installation
Prerequisites
Python 3.9+

Node.js & npm

MongoDB (Local or Atlas Cluster)

A valid Google AI Studio API Key

1. Backend Setup
Open a terminal and navigate to the backend directory:

Bash
cd backend
python -m venv venv
source venv/Scripts/activate  # On Windows. Use `source venv/bin/activate` on Mac/Linux
pip install fastapi uvicorn python-multipart requests pdfminer.six pymongo google-generativeai passlib bcrypt pyjwt
Create a .env file in your backend folder and add your keys:

Code snippet
GEMINI_API_KEY=your_google_api_key_here
SECRET_KEY=your_random_jwt_secret_here
MONGO_URI=mongodb://localhost:27017
Start the FastAPI server:

Bash
python -m uvicorn main:app --reload
2. Frontend Setup
Open a second, separate terminal and navigate to the frontend directory:

Bash
cd frontend
npm install
npm install react-router-dom axios react-dropzone @react-three/fiber @react-three/drei
Start the React development server:

Bash
npm start
The application will now be running on http://localhost:3000 with the backend listening on [http://127.0.0.1:8000](http://127.0.0.1:8000).

🔮 Future Scope
RAG Architecture: Implementing Retrieval-Augmented Generation with Vector Embeddings for mathematically precise job matching.

Automated Upskilling: Directly linking identified "Missing Skills" to highly-rated, free Coursera and YouTube learning paths.