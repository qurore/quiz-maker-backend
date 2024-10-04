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
  if (chapter) {
    const chapters = chapter.split(',');
    query.chapter = { $in: chapters };
  }
  const questions = await Question.find(query);
  res.json(questions);
});

// Add incorrect question
app.post('/api/incorrects', async (req, res) => {
  const { subjectId, questionId, chapter } = req.body;
  try {
    await Incorrect.findOneAndUpdate(
      { subjectId, questionId, chapter },
      { subjectId, questionId, chapter },
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
    const { subjectId, chapters } = req.query;
    const chapterArray = chapters ? chapters.split(',') : [];
    
    let query = { subjectId };
    if (chapterArray.length > 0) {
      query.chapter = { $in: chapterArray };
    }

    const incorrects = await Incorrect.find(query);
    if (incorrects.length === 0) {
      return res.json([]);
    }

    const incorrectQuestions = await Question.find({
      $or: incorrects.map(({ subjectId, questionId, chapter }) => ({ subjectId, questionId, chapter }))
    });
    res.json(incorrectQuestions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching incorrect questions' });
  }
});

// Remove question from incorrects
app.delete('/api/incorrects', async (req, res) => {
  const { subjectId, questionId, chapter } = req.body;
  try {
    await Incorrect.findOneAndDelete({ subjectId, questionId, chapter });
    res.status(200).json({ message: 'Question removed from incorrects successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing question from incorrects' });
  }
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});