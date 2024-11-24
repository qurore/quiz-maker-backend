const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
});

module.exports = mongoose.model('Subject', SubjectSchema); 