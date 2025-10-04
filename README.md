# Quiz Maker Backend

A RESTful API backend service for a quiz application built with Node.js, Express, and MongoDB. This service handles quiz questions, subjects, chapters, and tracks incorrect answers for review.

## Features

- **Subject Management**: Create, read, update, and delete quiz subjects
- **Question Management**: Store and retrieve quiz questions with multiple question types (MCQ, Fill-in-the-blank)
- **Chapter Organization**: Organize questions by chapters within subjects
- **Incorrect Answer Tracking**: Keep track of questions answered incorrectly for focused review
- **CSV Import**: Bulk import questions from CSV files
- **Review Statistics**: Get detailed statistics on quiz performance
- **Wikipedia Integration**: Fetch term definitions from Wikipedia for enhanced learning

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/quiz-maker-backend.git
cd quiz-maker-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
# For local MongoDB
MONGODB_URI=mongodb://localhost:27017/quiz-maker

# For MongoDB Atlas (replace with your connection string)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/quiz-maker?retryWrites=true&w=majority

# Server port
PORT=5005
```

5. Start the server:
```bash
node server.js
```

The server will start running on `http://localhost:5005` (or your configured port).

## API Endpoints

### Subjects

- `GET /api/subjects` - Get all subjects with question counts
- `GET /api/subjects/:subjectId` - Get a specific subject
- `PUT /api/subjects/:id` - Update a subject name
- `DELETE /api/subjects/:id` - Delete a subject and its questions

### Questions

- `GET /api/questions?subjectId=XXX&chapter=YYY` - Get questions (filtered by subject and optional chapters)
- `GET /api/subjects/:subjectId/chapters` - Get all chapters for a subject

### Incorrect Questions

- `POST /api/incorrects` - Mark a question as incorrectly answered
- `GET /api/incorrects?subjectId=XXX&chapters=YYY,ZZZ` - Get incorrect questions
- `DELETE /api/incorrects` - Remove a question from incorrect list

### Statistics

- `GET /api/review-stats` - Get comprehensive review statistics

### Utilities

- `POST /api/upload-csv` - Upload CSV file to import questions
- `GET /api/wikipedia/:word` - Fetch Wikipedia definition for a term

## CSV Import Format

To import questions via CSV, use the following format:

| Column | Description | Required | Example |
|--------|------------|----------|---------|
| subject | Subject identifier | Yes | MATH101 |
| chapter | Chapter name | Yes | Chapter 1 |
| questionType | Type of question (MCQ/FIB) | No | MCQ |
| question | Question text | Yes | What is 2+2? |
| option_1 to option_6 | Answer options | For MCQ | 3, 4, 5, 6 |
| answer | Correct answer(s) | Yes | 2 |
| explanation | Answer explanation | No | Basic addition |

## Data Models

### Subject
```javascript
{
  id: String,      // Unique identifier
  name: String     // Display name
}
```

### Question
```javascript
{
  subjectId: String,
  questionId: Number,
  chapter: String,
  questionType: String,  // "MCQ" or "FIB"
  questionText: String,
  options: Object,       // For MCQ questions
  answer: Array,         // Correct answer(s)
  explanation: String
}
```

### Incorrect
```javascript
{
  subjectId: String,
  questionId: Number,
  chapter: String
}
```

## Project Structure

```
quiz-maker-backend/
├── models/           # MongoDB schema definitions
│   ├── index.js
│   ├── question.js
│   ├── subject.js
│   └── incorrect.js
├── uploads/          # Temporary CSV upload directory
├── server.js         # Main application file
├── .env.example      # Environment variables template
└── package.json      # Project dependencies
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

Error responses include a JSON object with an `error` field describing the issue.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

If you encounter any problems or have suggestions, please open an issue on GitHub.

## Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Database powered by [MongoDB](https://www.mongodb.com/)
- CSV parsing by [csv-parser](https://www.npmjs.com/package/csv-parser)