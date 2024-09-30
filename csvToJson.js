const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const csvDir = path.join(__dirname, 'csv_data');
const outputDir = path.join(__dirname, 'seed_data');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

fs.readdirSync(csvDir).forEach(file => {
  if (path.extname(file) === '.csv') {
    const results = [];
    const subjectId = path.basename(file, '.csv');
    let questionId = 1;

    fs.createReadStream(path.join(csvDir, file))
      .pipe(csv())
      .on('data', (data) => {
        const question = {
          subjectId,
          questionId: questionId++,
          chapter: data.chapter,
          type: data.type,
          questionText: data.question,
          options: [data.option_1, data.option_2, data.option_3, data.option_4, data.option_5, data.option_6].filter(Boolean),
          answer: data.answers,
          explanation: data.explanation || ''
        };
        results.push(question);
      })
      .on('end', () => {
        const jsonOutput = JSON.stringify(results, null, 2);
        fs.writeFileSync(path.join(outputDir, `${subjectId}.json`), jsonOutput);
        console.log(`Transformed ${file} to JSON`);
      });
  }
});
