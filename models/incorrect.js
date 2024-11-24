const mongoose = require('mongoose');

const IncorrectSchema = new mongoose.Schema({
  subjectId: { type: String, required: true },
  questionId: { type: Number, required: true },
  chapter: { type: String, required: true },
});

IncorrectSchema.index({ subjectId: 1, questionId: 1}, { unique: true });
IncorrectSchema.index({ subjectId: 1, questionId: 1, chapter: 1 }, { unique: true });

module.exports = mongoose.model('Incorrect', IncorrectSchema); 