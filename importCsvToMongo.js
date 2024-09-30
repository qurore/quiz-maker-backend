const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const { Subject, Question } = require('./models');

const csvDir = path.join(__dirname, 'csv_data');

mongoose.connect('mongodb://localhost:27017/quiz-maker');

async function importCsvToMongo(file) {
  const subjectId = path.basename(file, '.csv');
  let questionId = 1;
  const questions = [];

  // Upsert subject
  await Subject.findOneAndUpdate(
    { id: subjectId },
    { id: subjectId, name: subjectId },
    { upsert: true, new: true }
  );

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(csvDir, file))
      .pipe(csv())
      .on('data', (data) => {
        const question = {
          subjectId,
          questionId: questionId++,
          chapter: data.chapter,
          questionType: data.questionType,
          questionText: data.question,
          options: [data.option_1, data.option_2, data.option_3, data.option_4, data.option_5, data.option_6].filter(Boolean),
          answer: data.answers,
          explanation: data.explanation || ''
        };
        questions.push(question);
      })
      .on('end', async () => {
        try {
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