const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const { Subject, Question } = require('./models');

const csvDir = path.join(__dirname, 'csv_data');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

async function importCsvToMongo(file) {
  let questionId = 1;
  const questions = [];
  const subjects = new Set();

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(csvDir, file))
      .pipe(csv({
        mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim()
      }))
      .on('data', (data) => {
        const subjectId = data.subject;
        subjects.add(subjectId);

        const options = {};
        for (let i = 1; i <= 6; i++) {
          if (data[`question_${i}`]) {
            options[i - 1] = data[`question_${i}`];
          }
        }

        let answer;
        if (data.questionType === 'FIB') {
          answer = [data.answer];
        } else {
          answer = data.answer.split(',').map(a => parseInt(a) - 1);
        }

        const question = {
          subjectId: subjectId,
          questionId: questionId++,
          chapter: data.chapter,
          questionType: data.questionType,
          questionText: data.question,
          options: options,
          answer: answer,
          explanation: data.explanation || ''
        };
        questions.push(question);
      })
      .on('end', async () => {
        try {
          // Upsert subjects
          for (const subjectId of subjects) {
            await Subject.findOneAndUpdate(
              { id: subjectId },
              { id: subjectId, name: subjectId.toUpperCase() },
              { upsert: true, new: true }
            );
          }

          // Upsert questions
          for (const question of questions) {
            await Question.findOneAndUpdate(
              { subjectId: question.subjectId, questionId: question.questionId },
              question,
              { upsert: true, new: true }
            );
          }
          console.log(`Imported ${file} to MongoDB`);
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importAllCsvFiles() {
  const files = fs.readdirSync(csvDir).filter(file => path.extname(file) === '.csv');

  for (const file of files) {
    await importCsvToMongo(file);
  }

  mongoose.connection.close();
  console.log('All CSV files imported to MongoDB');
}

importAllCsvFiles().catch(console.error);
