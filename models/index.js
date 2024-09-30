const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
});

const QuestionSchema = new mongoose.Schema({
  subjectId: { type: String, required: true },
  questionId: { type: Number, required: true },
  chapter: { type: String, required: true },
  type: { type: String, enum: ['MCQ', 'FIB', 'SA'], required: true },
  questionText: { type: String, required: true },
  options: [String],
  answer: { type: String, required: true },
  explanation: { type: String, required: true },
});

// Add composite index
QuestionSchema.index({ subjectId: 1, questionId: 1 }, { unique: true });

const Subject = mongoose.model('Subject', SubjectSchema);
const Question = mongoose.model('Question', QuestionSchema);

module.exports = { Subject, Question };