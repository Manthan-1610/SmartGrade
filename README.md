# SmartGrade

AI-powered exam grading assistant for teachers. SmartGrade digitizes and pre-grades handwritten assessments using semantic understanding, not simple keyword matching.

## Features

- **Dynamic Exam Template Builder**: Create exams with multiple questions, each with custom marks and ideal answers
- **AI-Powered Rubric Generation**: Uses Gemini AI to analyze your exam and generate grading strategies
- **Teacher Verification**: Review and confirm AI interpretations before finalizing
- **Mobile-Responsive UI**: Works on phones and tablets for on-the-go exam creation

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL with SQLModel ORM
- **AI**: Google Gemini API

## Project Structure

```
SmartGrade/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry
│   │   ├── config.py        # Environment config
│   │   ├── database.py      # DB connection
│   │   ├── models.py        # SQLModel schemas
│   │   ├── schemas.py       # Pydantic request/response
│   │   ├── routes/
│   │   │   ├── exams.py     # Exam CRUD endpoints
│   │   │   └── verify.py    # AI verification endpoint
│   │   └── services/
│   │       └── gemini.py    # Gemini API integration
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities and API
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

1. Create a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Linux/Mac
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/smartgrade
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Create the database:
   ```bash
   # In PostgreSQL
   CREATE DATABASE smartgrade;
   ```

5. Run the server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/verify-template` | Analyze exam with AI |
| POST | `/api/exams` | Save finalized exam |
| GET | `/api/exams` | List all exams |
| GET | `/api/exams/{id}` | Get single exam |
| DELETE | `/api/exams/{id}` | Delete exam |

## Usage

1. **Create Exam**: Enter exam title, subject, and add questions with marks and ideal answers
2. **Generate AI Rubric**: Click "Generate AI Rubric" to analyze with Gemini
3. **Review**: Verify the AI's interpretation of grading criteria
4. **Finalize**: Confirm to save the exam template

## Development

The AI verification works with or without a Gemini API key:
- **With API key**: Full AI analysis using Gemini
- **Without API key**: Mock responses for testing UI

## License

MIT
