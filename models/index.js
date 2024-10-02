const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
});

const QuestionSchema = new mongoose.Schema({
  subjectId: { type: String, required: true },
  questionId: { type: Number, required: true },
  chapter: { type: String, required: true },
  questionType: { type: String, enum: ['MCQ', 'FIB', 'SA'], required: true },
  questionText: { type: String, required: true },
  options: {
    type: Map,
    of: String,
    validate: {
      validator: function(v) {
        return Object.keys(v).every(key => /^[0-9]+$/.test(key));
      },
      message: props => 'Option keys must be numeric strings starting from 0'
    }
  },
  answer: {
    type: [mongoose.Schema.Types.Mixed],
    validate: {
      validator: function(v) {
        if (this.questionType === 'FIB') {
          return v.length === 1 && typeof v[0] === 'string';
        } else {
          return v.every(item => typeof item === 'number');
        }
      },
      message: props => 'Answer must be an array of numbers for MCQ/SA, or a single string for FIB'
    }
  },
  explanation: { type: String, required: true },
});

const IncorrectSchema = new mongoose.Schema({
  subjectId: { type: String, required: true },
  questionId: { type: Number, required: true },
});

// Add composite index for Incorrect schema
IncorrectSchema.index({ subjectId: 1, questionId: 1}, { unique: true });

// Add composite index
QuestionSchema.index({ subjectId: 1, questionId: 1 }, { unique: true });

const Subject = mongoose.model('Subject', SubjectSchema);
const Question = mongoose.model('Question', QuestionSchema);
const Incorrect = mongoose.model('Incorrect', IncorrectSchema);

module.exports = { Subject, Question, Incorrect };