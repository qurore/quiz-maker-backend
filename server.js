const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/quiz-maker');

// Define Schemas and Models
const SubjectSchema = new mongoose.Schema({
  name: String,
});

const QuestionSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  chapter: String,
  type: String, // 'MCQ' or 'FIB' (Fill in the Blank)
  questionText: String,
  options: [String], // For MCQ
  answer: String,
  explanation: String,
});

const Subject = mongoose.model('Subject', SubjectSchema);
const Question = mongoose.model('Question', QuestionSchema);

// API Endpoints

// Get all subjects
app.get('/api/subjects', async (req, res) => {
  const subjects = await Subject.find();
  res.json(subjects);
});

// Get chapters for a subject
app.get('/api/subjects/:subjectId/chapters', async (req, res) => {
  const { subjectId } = req.params;
  const chapters = await Question.distinct('chapter', { subjectId });
  res.json(chapters);
});

// Update the existing questions endpoint
app.get('/api/questions', async (req, res) => {
  const { subjectId, chapter } = req.query;
  let query = { subjectId };
  if (chapter) query.chapter = chapter;
  const questions = await Question.find(query);
  res.json(questions);
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
