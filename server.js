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
          // データの正規化
          const normalizedData = Object.keys(data).reduce((acc, key) => {
            let value = data[key];
            let normalizedKey = key.toLowerCase();

            // キーの正規化
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

          // subjectが無い場合はファイル名から推測
          if (!normalizedData.subject) {
            const fileName = path.basename(filePath, '.csv');
            normalizedData.subject = fileName.split('_')[0].toUpperCase();
          }

          // answersフィールドの値をanswerフィールドにコピー
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

          // questionTypeのデフォルト値設定
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

          // answerの処理
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
          // エラーをスキップして続行
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

// Start the server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});