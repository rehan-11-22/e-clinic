import express from "express";
import { dbConnection } from "./database/dbConnection.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import fileUpload from "express-fileupload";
import { errorMiddleware } from "./middlewares/error.js";
import messageRouter from "./router/messageRouter.js";
import userRouter from "./router/userRouter.js";
import appointmentRouter from "./router/appointmentRouter.js";
import sql from "mssql";
import { AzureOpenAI } from "openai";

const app = express();

dotenv.config();

// Initialize OpenAI client
const openAIClient = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: process.env.AZURE_OPENAI_VERSION,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
});

// SQL Server configuration
const dbConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

app.use(
  cors({
    origin: [process.env.FRONTEND_URL, process.env.DASHBOARD_URL],
    method: ["GET", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/appointment", appointmentRouter);

// API Endpoint for processing questions
app.post("/api/medical-query", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const classification = await classifyQuestion(question);

    if (classification === "database") {
      // Generate SQL
      const sql = await englishToSql(question);
      let results;
      let answer;

      try {
        // Execute query
        results = await runQuery(sql);

        // Generate natural language summary for chat tab
        answer = await generateResultSummary(question, results);

        return res.json({
          type: "database",
          question,
          sql,
          results, // For results tab
          answer, // For chat tab
          tab: "results", // Which tab to show first
        });
      } catch (sqlError) {
        // If SQL error, fallback to health answer
        answer = await answerHealthQuestion(question);
        return res.json({
          type: "health",
          question,
          answer,
          error: sqlError.message,
          tab: "chat",
        });
      }
    } else {
      // General health answer
      const answer = await answerHealthQuestion(question);
      res.json({
        type: "health",
        question,
        answer,
        tab: "chat",
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      error: "An error occurred",
      details: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Medical Query API is running" });
});

app.get("/", (req, res) => {
  res.send("Welcome to the homepage!");
});
dbConnection();

app.use(errorMiddleware);
export default app;

// Function to convert English to SQL
async function englishToSql(question) {
  const prompt = `
  You are a medical database expert. Convert this English question to SQL Server T-SQL.

  IMPORTANT: Use the exact table names as defined below.
  Database schema for E-Cure-Hub:

    - Table 'medical_specialties':
      * id (primary key, INT IDENTITY)
      * name (VARCHAR(100), NOT NULL, UNIQUE)
      * description (TEXT)
      * created_at (DATETIME, DEFAULT GETDATE())

    - Table 'doctors':
      * id (primary key, INT IDENTITY)
      * firstName (VARCHAR(100), NOT NULL)
      * lastName (VARCHAR(100), NOT NULL)
      * fullName (computed column: firstName + ' ' + lastName)
      * specialtyId (INT, foreign key to medical_specialties.id)
      * experience_years (INT)
      * qualification (VARCHAR(500))
      * is_available (BIT, DEFAULT 1)
      * rating (DECIMAL(3,2), DEFAULT 0.00)
      * created_at (DATETIME, DEFAULT GETDATE())
      
      IMPORTANT: Do NOT include or query these sensitive fields: email, phoneNumber, address, city, state, zipCode, consultation_fee

    - Table 'veterinary_doctors':
      * id (primary key, INT IDENTITY)
      * firstName (VARCHAR(100), NOT NULL)
      * lastName (VARCHAR(100), NOT NULL)
      * fullName (computed column: firstName + ' ' + lastName)
      * specialization (VARCHAR(200)) -- e.g., Small Animals, Large Animals, Exotic Animals
      * experience_years (INT)
      * qualification (VARCHAR(500))
      * is_available (BIT, DEFAULT 1)
      * rating (DECIMAL(3,2), DEFAULT 0.00)
      * created_at (DATETIME, DEFAULT GETDATE())
      
      IMPORTANT: Do NOT include or query these sensitive fields: email, phoneNumber, address, city, state, zipCode, consultation_fee

    - Table 'human_diseases':
      * id (primary key, INT IDENTITY)
      * name (VARCHAR(200), NOT NULL)
      * description (TEXT)
      * common_symptoms (TEXT) -- JSON array or comma-separated
      * severity_level (VARCHAR(20)) -- 'Mild', 'Moderate', 'Severe', 'Critical'
      * recommended_specialty_id (INT, foreign key to medical_specialties.id)
      * prevention_tips (TEXT)
      * when_to_see_doctor (TEXT)
      * created_at (DATETIME, DEFAULT GETDATE())

    - Table 'animal_diseases':
      * id (primary key, INT IDENTITY)
      * name (VARCHAR(200), NOT NULL)
      * description (TEXT)
      * common_symptoms (TEXT) -- JSON array or comma-separated
      * affected_animals (VARCHAR(500)) -- e.g., Dogs, Cats, Birds, etc.
      * severity_level (VARCHAR(20)) -- 'Mild', 'Moderate', 'Severe', 'Critical'
      * prevention_tips (TEXT)
      * when_to_see_vet (TEXT)
      * created_at (DATETIME, DEFAULT GETDATE())

    - Table 'symptoms':
      * id (primary key, INT IDENTITY)
      * name (VARCHAR(200), NOT NULL, UNIQUE)
      * description (TEXT)
      * body_system (VARCHAR(100)) -- e.g., Respiratory, Cardiovascular, Digestive
      * severity_indicator (VARCHAR(20)) -- 'Mild', 'Moderate', 'Severe'
      * created_at (DATETIME, DEFAULT GETDATE())

    - Table 'human_disease_symptoms':
      * id (primary key, INT IDENTITY)
      * disease_id (INT, foreign key to human_diseases.id)
      * symptom_id (INT, foreign key to symptoms.id)
      * is_primary_symptom (BIT, DEFAULT 0)

    - Table 'animal_disease_symptoms':
      * id (primary key, INT IDENTITY)
      * disease_id (INT, foreign key to animal_diseases.id)
      * symptom_id (INT, foreign key to symptoms.id)
      * is_primary_symptom (BIT, DEFAULT 0)

    - Table 'appointments':
      * id (primary key, INT IDENTITY)
      * patient_name (VARCHAR(200), NOT NULL)
      * patient_phone (VARCHAR(20), NOT NULL)
      * patient_email (VARCHAR(255))
      * doctor_id (INT, foreign key to doctors.id)
      * vet_doctor_id (INT, foreign key to veterinary_doctors.id)
      * appointment_date (DATETIME, NOT NULL)
      * appointment_type (VARCHAR(50)) -- 'Human' or 'Animal'
      * animal_type (VARCHAR(100)) -- For animal appointments
      * symptoms_description (TEXT)
      * status (VARCHAR(20), DEFAULT 'Scheduled') -- 'Scheduled', 'Completed', 'Cancelled', 'No-Show'
      * created_at (DATETIME, DEFAULT GETDATE())

  Available Views:
    - vw_human_diseases_with_symptoms: Shows diseases with their symptoms concatenated
    - vw_animal_diseases_with_symptoms: Shows animal diseases with their symptoms concatenated

  Available Stored Procedures:
    - GetHumanDiseasesBySymptoms: Find diseases by comma-separated symptoms
    - GetAnimalDiseasesBySymptoms: Find animal diseases by symptoms and optional animal type
    - GetDoctorsBySpecialty: Get doctors by specialty name (excludes sensitive information)
    - GetVeterinaryDoctors: Get veterinary doctors by optional specialization
    - BookAppointment: Book a new appointment

  IMPORTANT SECURITY RULES:
  1. NEVER include or query sensitive doctor information: email, phoneNumber, address, city, state, zipCode, consultation_fee
  2. When querying doctors or veterinary_doctors, only select: id, firstName, lastName, fullName, specialtyId/specialization, experience_years, qualification, is_available, rating, created_at
  3. Use SQL Server T-SQL syntax (not MySQL)
  4. For better performance, consider using the provided stored procedures when applicable

  Only respond with the SQL query, nothing else.

  Question: ${question}
  `;

  const response = await openAIClient.chat.completions.create({
    model: "gpt-35-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  let sql = response.choices[0].message.content.trim();

  // Clean up the SQL query - remove any potential sensitive field references
  sql = sql.replace(
    /,\s*(email|phoneNumber|address|city|state|zipCode|consultation_fee)\b/gi,
    ""
  );
  sql = sql.replace(
    /\b(email|phoneNumber|address|city|state|zipCode|consultation_fee)\s*,/gi,
    ""
  );
  sql = sql.replace(
    /SELECT\s+(email|phoneNumber|address|city|state|zipCode|consultation_fee)\b/gi,
    "SELECT id"
  );

  return sql;
}
// Function to execute SQL query
async function runQuery(sqlQuery) {
  try {
    await sql.connect(dbConfig);
    const result = await sql.query(sqlQuery);
    return result.recordset; // SQL Server returns results in .recordset
  } catch (err) {
    console.error("SQL Server error:", err);
    throw err;
  } finally {
    sql.close(); // Close the connection
  }
}

// Function to generate a natural language summary of query results
async function generateResultSummary(question, results) {
  console.log("Query results generateResultSummary:", results);

  // First get the actual count from the results
  const resultCount = Array.isArray(results) ? results.length : 0;

  const prompt = `
  You are a medical database assistant. Summarize these query results in a clear, concise way for the user.

  IMPORTANT: The actual number of results is ${resultCount}. Make sure your summary reflects this exact number.

  Original question: ${question}
  
  Query results (JSON format):
  ${JSON.stringify(results, null, 2)}

  Provide a brief summary that:
  1. Answers the original question directly
  2. Explicitly states there are ${resultCount} results found
  3. Highlights 1-2 key pieces of information from the results
  4. Is written in natural language (not technical)
  5. MUST use the exact result count of ${resultCount}

  Keep it to 2-3 sentences maximum.

  Example format:
  "There are [${resultCount}] [records] that match your query about [topic]. The results show [key finding 1] and [key finding 2]."
  `;

  const response = await openAIClient.chat.completions.create({
    model: "gpt-35-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  let summary = response.choices[0].message.content.trim();

  // Double-check that the count is correct in the response
  if (!summary.includes(`${resultCount}`)) {
    summary = summary.replace(/\d+/, `${resultCount}`);
  }

  return summary;
}

// Function to answer general health questions using OpenAI
async function answerHealthQuestion(question) {
  const prompt = `
  You are a helpful and knowledgeable medical assistant created by Rehan, an assoicate software engineer . Your purpose is to assist medical database queries and health information. Answer the following health-related question in a clear, concise, and accurate manner. 
  If the question is about symptoms, treatments, medications, ICD codes, CPT codes, or general health, provide an informative answer. 
  If you don't know the answer, say so. Keep responses brief but informative (2-3 sentences maximum).

  Question: ${question}
  `;

  const response = await openAIClient.chat.completions.create({
    model: "gpt-35-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}

// Determine whether the question is a database query or a health query using AI
async function classifyQuestion(question) {
  const prompt = `
You are an expert in medical software and healthcare knowledge. Your task is to classify the following question.

Respond only with:
- "database" if the question should be answered using a SQL query from a medical database (like patient, provider, encounter, etc.),
- "health" if the question is about general health knowledge, medical conditions, ICD/CPT codes, symptoms, or treatments.

DO NOT return anything else. No explanations.

Question: ${question}
`;

  const response = await openAIClient.chat.completions.create({
    model: "gpt-35-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  return response.choices[0].message.content.trim().toLowerCase();
}
