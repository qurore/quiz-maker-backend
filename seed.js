const mongoose = require('mongoose');

// Same Schemas as in server.js
const SubjectSchema = new mongoose.Schema({
  name: String,
});

const QuestionSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  chapter: String,
  type: String,
  questionText: String,
  options: [String],
  answer: String,
  explanation: String,
});

const Subject = mongoose.model('Subject', SubjectSchema);
const Question = mongoose.model('Question', QuestionSchema);

mongoose.connect('mongodb://localhost:27017/quiz-maker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function seedDatabase() {
  await Subject.deleteMany({});
  await Question.deleteMany({});

  const math = new Subject({ name: 'Mathematics' });
  const science = new Subject({ name: 'Science' });

  await math.save();
  await science.save();

  const questions = [
    {
      subject: math._id,
      chapter: 'Algebra',
      type: 'MCQ',
      questionText: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      answer: '4',
      explanation: '2 + 2 equals 4.',
    },
    {
      subject: science._id,
      chapter: 'Physics',
      type: 'FIB',
      questionText: 'The force of gravity on Earth is ____ m/s².',
      options: [],
      answer: '9.8',
      explanation: 'The standard gravity is 9.8 m/s².',
    },
  ];

  await Question.insertMany(questions);
  console.log('Database seeded!');
  mongoose.connection.close();
}

seedDatabase();
