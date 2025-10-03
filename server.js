require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Subject, Question, Incorrect } = require('./models');
const csv = require('csv-parser');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Endpoints
// Get all subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find();
    const subjectsWithCount = await Promise.all(
      subjects.map(async (subject) => {
        const count = await Question.countDocuments({ subjectId: subject.id });
        return {
          ...subject.toObject(),
          questionCount: count
        };
      })
    );
    res.json(subjectsWithCount);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching subjects' });
  }
});

// Get chapters for a subject
app.get('/api/subjects/:subjectId/chapters', async (req, res) => {
  const { subjectId } = req.params;
  try {
    const chapters = await Question.aggregate([
      { $match: { subjectId } },
      {
        $group: {
          _id: '$chapter',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(chapters.map(c => ({ name: c._id, count: c.count })));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching chapters' });
  }
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
    const result = await Incorrect.findOneAndDelete({ subjectId, questionId, chapter });
    if (result) {
      res.status(200).json({ message: 'Question removed from incorrects successfully' });
    } else {
      res.status(404).json({ message: 'Question not found in incorrects' });
    }
  } catch (error) {
    console.error('Error removing question from incorrects:', error);
    res.status(500).json({ error: 'Error removing question from incorrects' });
  }
});

// Update subject
app.put('/api/subjects/:id', async (req, res) => {
  try {
    const subject = await Subject.findOneAndUpdate(
      { id: req.params.id },
      { name: req.body.name },
      { new: true }
    );
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: 'Error updating subject' });
  }
});

// Delete subject
app.delete('/api/subjects/:id', async (req, res) => {
  try {
    const subject = await Subject.findOneAndDelete({ id: req.params.id });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    // Also delete related questions
    await Question.deleteMany({ subjectId: req.params.id });
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting subject' });
  }
});

// CSV processing function
const processCsvFile = async (filePath) => {
  let questionId = 1;
  const questions = [];
  const subjects = new Set();

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => {
          if (!header) return header;
          return header
            .replace(/^\uFEFF/, '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '_');
        }
      }))
      .on('data', (data) => {
        try {
          // Data normalization
          const normalizedData = Object.keys(data).reduce((acc, key) => {
            let value = data[key];
            let normalizedKey = key.toLowerCase();

            // Key normalization
            switch (normalizedKey) {
              case 'type':
                normalizedKey = 'questiontype';
                break;
              case 'answers':
                normalizedKey = 'answer';
                break;
              case 'subject_id':
                normalizedKey = 'subject';
                break;
            }

            acc[normalizedKey] = value;
            return acc;
          }, {});

          // If subject is missing, infer from filename
          if (!normalizedData.subject) {
            const fileName = path.basename(filePath, '.csv');
            normalizedData.subject = fileName.split('_')[0].toUpperCase();
          }

          // Copy answers field value to answer field
          if (!normalizedData.answer && normalizedData.answers) {
            normalizedData.answer = normalizedData.answers;
          }

          const requiredFields = ['subject', 'chapter', 'question'];
          const missingFields = requiredFields.filter(field => 
            !normalizedData[field] || normalizedData[field].trim() === ''
          );
          
          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          // Set default value for questionType
          if (!normalizedData.questiontype) {
            normalizedData.questiontype = 'MCQ';
          }

          const subjectId = normalizedData.subject.trim();
          subjects.add(subjectId);

          const options = {};
          for (let i = 1; i <= 6; i++) {
            const optionKey = `option_${i}`;
            if (normalizedData[optionKey] && normalizedData[optionKey].trim() !== '') {
              options[i - 1] = normalizedData[optionKey].trim();
            }
          }

          // answer processing
          const answer = normalizedData.answer || normalizedData.answers || '1';

          questions.push({
            id: questionId++,
            subjectId: subjectId,
            chapter: normalizedData.chapter.trim(),
            questionType: normalizedData.questiontype.trim().toUpperCase(),
            question: normalizedData.question.trim(),
            answer: answer,
            options: options,
            explanation: (normalizedData.explanation || '').trim()
          });
        } catch (error) {
          console.error('Error processing row:', error);
          console.error('Row data:', data);
          // Skip error and continue
          console.warn('Skipping row due to error');
        }
      })
      .on('end', () => {
        if (questions.length === 0) {
          reject(new Error('No valid questions found in CSV file'));
        } else {
          resolve({ questions, subjects });
        }
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(error);
      });
  });
};

// CSV upload endpoint
app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    
    try {
      const { questions, subjects } = await processCsvFile(filePath);
      console.log(`Processing ${questions.length} questions for ${subjects.size} subjects`);

      // For each subject in the CSV
      for (const subjectId of subjects) {
        // Delete existing questions and incorrects for this subject
        await Promise.all([
          Question.deleteMany({ subjectId }),
          Incorrect.deleteMany({ subjectId })
        ]);

        // Then update/insert the subject
        await Subject.findOneAndUpdate(
          { id: subjectId },
          { id: subjectId, name: subjectId.toUpperCase() },
          { upsert: true }
        );
      }

      // Insert new questions
      for (const question of questions) {
        const questionData = {
          subjectId: question.subjectId,
          questionId: question.id,
          chapter: question.chapter,
          questionType: question.questionType,
          questionText: question.question,
          options: question.options,
          answer: question.questionType === 'FIB' 
            ? [question.answer] 
            : question.answer.split(',').map(a => parseInt(a.trim()) - 1),
          explanation: question.explanation
        };

        await Question.findOneAndUpdate(
          { subjectId: questionData.subjectId, questionId: questionData.questionId },
          questionData,
          { upsert: true }
        );
      }

      // Clean up
      await fsPromises.unlink(filePath);

      res.json({ 
        message: 'File processed successfully',
        stats: {
          questionsProcessed: questions.length,
          subjectsProcessed: subjects.size
        }
      });
    } catch (error) {
      // post process
      try {
        await fsPromises.unlink(filePath);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error processing CSV:', error);
    res.status(500).json({ 
      error: 'Error processing file',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get review statistics
app.get('/api/review-stats', async (req, res) => {
  try {
    const totalQuestions = await Question.countDocuments();
    const totalIncorrect = await Incorrect.countDocuments();

    // Subject statistics with names
    const subjectStats = await Question.aggregate([
      {
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: 'id',
          as: 'subject'
        }
      },
      {
        $group: {
          _id: '$subjectId',
          subjectName: { $first: { $arrayElemAt: ['$subject.name', 0] } },
          totalQuestions: { $sum: 1 }
        }
      }
    ]);

    const subjectIncorrects = await Incorrect.aggregate([
      {
        $group: {
          _id: '$subjectId',
          incorrectCount: { $sum: 1 }
        }
      }
    ]);

    // Chapter statistics
    const chapterStats = await Question.aggregate([
      {
        $group: {
          _id: { subject: '$subjectId', chapter: '$chapter' },
          totalQuestions: { $sum: 1 }
        }
      }
    ]);

    // Chapter incorrect count
    const chapterIncorrects = await Incorrect.aggregate([
      {
        $group: {
          _id: { subject: '$subjectId', chapter: '$chapter' },
          incorrectCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overall: {
        total: totalQuestions,
        incorrect: totalIncorrect,
        ratio: totalIncorrect / totalQuestions
      },
      bySubject: subjectStats.map(subject => ({
        subjectId: subject._id,
        subjectName: subject.subjectName,
        total: subject.totalQuestions,
        incorrect: subjectIncorrects.find(inc => inc._id === subject._id)?.incorrectCount || 0
      })),
      byChapter: chapterStats.map(chapter => {
        const subject = subjectStats.find(s => s._id === chapter._id.subject);
        return {
          subjectId: chapter._id.subject,
          subjectName: subject?.subjectName,
          chapter: chapter._id.chapter,
          total: chapter.totalQuestions,
          incorrect: chapterIncorrects.find(
            inc => inc._id.subject === chapter._id.subject && inc._id.chapter === chapter._id.chapter
          )?.incorrectCount || 0
        };
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching review statistics' });
  }
});

// Wikipedia API endpoint
app.get('/api/wikipedia/:word', async (req, res) => {
  const { word } = req.params;
  const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      titles: word,
      origin: '*'
    });

    const response = await fetch(`${WIKIPEDIA_API_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Extract the page content
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    const page = pages[pageId];

    if (pageId === '-1') {
      return res.status(404).json({ 
        status: 'not_found',
        message: 'No Wikipedia entry found for this term' 
      });
    }

    const processedData = {
      word: word,
      title: page.title,
      extract: page.extract,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`
    };
    
    res.json(processedData);
  } catch (error) {
    console.error('Wikipedia API error:', error);
    res.status(500).json({ error: 'Failed to fetch term definition' });
  }
});

// Start the server
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});