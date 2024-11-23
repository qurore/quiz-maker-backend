# Quiz Maker Backend

A Node.js backend service for managing quiz questions with MongoDB integration and CSV import capabilities.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Setup

1. Install dependencies: 

```
npm install
```

2. Ensure MongoDB is running locally on port 27017

## CSV Import Feature

The application supports importing quiz questions from CSV files. Place your CSV files in the `csv_data` directory.

### CSV Format Requirements

Your CSV file should have the following columns:

```
chapter,type,question,option_1,option_2,option_3,option_4,option_5,option_6,answers,explanation
```

Column descriptions:
- `chapter`: Chapter number or identifier
- `type`: Question type (MCQ, FIB, SA)
- `question`: The question text
- `option_1` to `option_6`: Multiple choice options (leave empty if not needed)
- `answers`: 
  - For MCQ: comma-separated numbers (1-6)
  - For FIB: text answer
- `explanation`: Explanation for the correct answer

### Sample CSV Row:


```
1,MCQ,"What is statistics?",True,False,,,,,1,"Explanation text here"
```

### Running the Import

1. Create a `csv_data` directory in the project root
2. Place your CSV files in the `csv_data` directory
3. Run the import script:

```
node importCsvToMongo.js
```