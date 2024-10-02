const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Subject, Question, Incorrect } = require('./models');

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/quiz-maker');

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

app.get('/api/subjects/:subjectId', async (req, res) => {
  const { subjectId } = req.params;
  const subject = await Subject.findOne({ id: subjectId });
  if (!subject) {
    return res.status(404).json({ error: 'Subject not found' });
  }
  res.json(subject);
});

// Update the existing questions endpoint
app.get('/api/questions', async (req, res) => {
  const { subjectId, chapter } = req.query;
  let query = { subjectId };
  if (chapter) query.chapter = chapter;
  const questions = await Question.find(query);
  res.json(questions);
});

// Add incorrect question
app.post('/api/incorrects', async (req, res) => {
  const { subjectId, questionId } = req.body;
  try {
    await Incorrect.findOneAndUpdate(
      { subjectId, questionId },
      { subjectId, questionId },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: 'Incorrect question added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error adding incorrect question' });
  }
});

// Get incorrect questions
app.get('/api/incorrects', async (req, res) => {
  try {
    const incorrects = await Incorrect.find();
    const incorrectQuestions = await Question.find({
      $or: incorrects.map(({ subjectId, questionId }) => ({ subjectId, questionId }))
    });
    res.json(incorrectQuestions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching incorrect questions' });
  }
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});