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
import emailRouter from "./router/emailRouter.js";
import sql from "mssql";
import { AzureOpenAI } from "openai";

// Load environment variables first
dotenv.config();

const app = express();

// Initialize OpenAI client with error handling
let openAIClient;
try {
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) {
    openAIClient = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_KEY,
      apiVersion: process.env.AZURE_OPENAI_VERSION || "2024-02-15-preview",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    });
    console.log("OpenAI client initialized successfully");
  } else {
    console.warn("OpenAI environment variables missing");
  }
} catch (error) {
  console.error("Failed to initialize OpenAI client:", error);
}

// SQL Server configuration with error handling
const dbConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.NODE_ENV === "production" ? true : false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.DASHBOARD_URL,
      "http://localhost:3000",
      "http://localhost:5173",
      "https://localhost:3000",
      "https://localhost:5173",
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// File upload middleware - better configuration for serverless
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: process.env.NODE_ENV === "production" ? "/tmp/" : "./tmp/",
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    abortOnLimit: true,
    createParentPath: true,
    safeFileNames: true,
    preserveExtension: true,
  })
);

// Health check endpoint (should be before other routes)
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Medical Query API!",
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Medical Query API is running",
    openai: !!openAIClient,
    database: !!process.env.SQL_SERVER,
  });
});

// API Routes
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/appointment", appointmentRouter);
app.use("/api/v1/email", emailRouter);

// Medical Query endpoint
app.post("/api/medical-query", async (req, res) => {
  try {
    const { question } = req.body;

    if (
      !question ||
      typeof question !== "string" ||
      question.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Question is required and must be a non-empty string",
      });
    }

    // Check if OpenAI client is initialized
    if (!openAIClient) {
      return res.status(500).json({
        error: "OpenAI service not available",
        details:
          "OpenAI client initialization failed. Please check configuration.",
      });
    }

    const classification = await classifyQuestion(question.trim());

    // Handle non-medical questions
    if (classification === "non-medical") {
      return res.json({
        type: "non-medical",
        question,
        answer:
          "I'm a medical assistant designed to help with health and medical-related questions only. Please ask about medical conditions, symptoms, treatments, healthcare providers, or other health-related topics.",
        tab: "chat",
      });
    }

    if (classification === "database") {
      try {
        // Generate SQL
        const sqlQuery = await englishToSql(question);
        let results;
        let answer;

        try {
          // Execute query
          results = await runQuery(sqlQuery);
          // Generate natural language summary for chat tab
          answer = await generateResultSummary(question, results);

          return res.json({
            type: "database",
            question,
            sql: sqlQuery,
            results, // For results tab
            answer, // For chat tab
            tab: "results", // Which tab to show first
          });
        } catch (sqlError) {
          console.error("SQL Error:", sqlError);
          // If SQL error, fallback to health answer
          answer = await answerHealthQuestion(question);
          return res.json({
            type: "health",
            question,
            answer,
            error: `Database query failed: ${sqlError.message}`,
            tab: "chat",
          });
        }
      } catch (sqlGenError) {
        console.error("SQL Generation Error:", sqlGenError);
        // Fallback to health answer
        const answer = await answerHealthQuestion(question);
        return res.json({
          type: "health",
          question,
          answer,
          tab: "chat",
        });
      }
    } else {
      // General health answer (already validated as medical)
      const answer = await answerHealthQuestion(question);
      return res.json({
        type: "health",
        question,
        answer,
        tab: "chat",
      });
    }
  } catch (error) {
    console.error("Error in /api/medical-query:", error);
    return res.status(500).json({
      error: "An error occurred while processing your request",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Initialize database connection for serverless
let dbConnectionPromise;
const initializeDatabase = async () => {
  if (!dbConnectionPromise) {
    dbConnectionPromise = dbConnection().catch((error) => {
      console.error("Database connection failed:", error);
      dbConnectionPromise = null; // Reset on failure
      throw error;
    });
  }
  return dbConnectionPromise;
};

// Initialize database connection
if (process.env.SQL_SERVER) {
  initializeDatabase().catch(console.error);
}

// Error handling middleware (should be last)
app.use(errorMiddleware);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Function to check if a question is medical/health-related
async function isMedicalQuestion(question) {
  try {
    const prompt = `You are an expert medical content validator. Determine if the following question is related to:
- Medical conditions, diseases, or health issues
- Symptoms or medical signs
- Treatments, medications, or therapies  
- Medical procedures or diagnostics
- Healthcare providers, specialties, or medical facilities
- Anatomy, physiology, or medical science
- Public health or preventive medicine
- Veterinary medicine or animal health
- Medical coding (ICD, CPT)
- Healthcare administration or medical databases

Respond only with "yes" if the question is medical/health-related, or "no" if it's not.

Examples of medical questions: "What are symptoms of diabetes?", "How is pneumonia treated?", "What doctors specialize in heart conditions?"
Examples of non-medical questions: "What's the weather?", "How to cook pasta?", "What's the capital of France?"

Question: ${question}`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    });

    return response.choices[0].message.content.trim().toLowerCase() === "yes";
  } catch (error) {
    console.error("Error in isMedicalQuestion:", error);
    // Default to true to be safe
    return true;
  }
}

// Determine whether the question is a database query or a health query using AI
async function classifyQuestion(question) {
  try {
    // First check if it's medical at all
    const isMedical = await isMedicalQuestion(question);

    if (!isMedical) {
      return "non-medical";
    }

    const prompt = `You are an expert in medical software and healthcare knowledge. Your task is to classify the following medical/health question.

Respond only with:
- "database" if the question should be answered using a SQL query from a medical database (like finding doctors, appointments, diseases, symptoms data),
- "health" if the question is about general health knowledge, medical conditions, treatments, or educational medical content.

Examples of database questions: "How many cardiologists are available?", "What diseases cause chest pain?", "Show me appointments for today"
Examples of health questions: "What are symptoms of diabetes?", "How is hypertension treated?", "What is pneumonia?"

DO NOT return anything else. No explanations.

Question: ${question}`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    });

    return response.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    console.error("Error in classifyQuestion:", error);
    // Default to health if classification fails
    return "health";
  }
}

// Function to convert English to SQL
async function englishToSql(question) {
  try {
    const prompt = `You are a medical database expert. Convert this English question to SQL Server T-SQL.

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

IMPORTANT SECURITY RULES:
1. NEVER include or query sensitive doctor information: email, phoneNumber, address, city, state, zipCode, consultation_fee
2. When querying doctors or veterinary_doctors, only select: id, firstName, lastName, fullName, specialtyId/specialization, experience_years, qualification, is_available, rating, created_at
3. Use SQL Server T-SQL syntax (not MySQL)

Only respond with the SQL query, nothing else.

Question: ${question}`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 500,
    });

    let sqlQuery = response.choices[0].message.content.trim();

    // Clean up potential code blocks
    sqlQuery = sqlQuery.replace(/```sql\s*/g, "").replace(/```\s*/g, "");

    // Clean up the SQL query - remove any potential sensitive field references
    sqlQuery = sqlQuery.replace(
      /,\s*(email|phoneNumber|address|city|state|zipCode|consultation_fee)\b/gi,
      ""
    );
    sqlQuery = sqlQuery.replace(
      /\b(email|phoneNumber|address|city|state|zipCode|consultation_fee)\s*,/gi,
      ""
    );
    sqlQuery = sqlQuery.replace(
      /SELECT\s+(email|phoneNumber|address|city|state|zipCode|consultation_fee)\b/gi,
      "SELECT id"
    );

    return sqlQuery;
  } catch (error) {
    console.error("Error in englishToSql:", error);
    throw new Error("Failed to generate SQL query");
  }
}

// Function to execute SQL query with connection pooling
async function runQuery(sqlQuery) {
  let pool;
  try {
    // Ensure database connection is initialized
    await initializeDatabase();

    pool = await sql.connect(dbConfig);
    const result = await pool.request().query(sqlQuery);
    return result.recordset || [];
  } catch (err) {
    console.error("SQL Server error:", err);
    throw new Error(`Database query failed: ${err.message}`);
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (closeError) {
        console.error("Error closing pool:", closeError);
      }
    }
  }
}

// Function to generate a natural language summary of query results
async function generateResultSummary(question, results) {
  try {
    const resultCount = Array.isArray(results) ? results.length : 0;

    const prompt = `You are a medical database assistant. Summarize these query results in a clear, concise way for the user.

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
"There are ${resultCount} records that match your query about [topic]. The results show [key finding 1] and [key finding 2]."`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 150,
    });

    let summary = response.choices[0].message.content.trim();

    // Double-check that the count is correct in the response
    if (!summary.includes(`${resultCount}`)) {
      summary = summary.replace(/\d+/, `${resultCount}`);
    }

    return summary;
  } catch (error) {
    console.error("Error in generateResultSummary:", error);
    const resultCount = Array.isArray(results) ? results.length : 0;
    return `Found ${resultCount} results for your query about "${question}".`;
  }
}

// Function to answer general health questions using OpenAI
async function answerHealthQuestion(question) {
  try {
    // First check if the question is medical/health-related
    const isMedical = await isMedicalQuestion(question);

    if (!isMedical) {
      return "I'm a medical assistant designed to help with health and medical-related questions only. Please ask about medical conditions, symptoms, treatments, healthcare providers, or other health-related topics.";
    }

    const prompt = `You are a helpful and knowledgeable medical assistant created by Rehan, an associate software engineer. Your purpose is to assist with medical queries and health information. Answer the following health-related question in a clear, concise, and accurate manner. 

If the question is about symptoms, treatments, medications, ICD codes, CPT codes, or general health, provide an informative answer. 
If you don't know the answer, say so. Keep responses brief but informative (2-3 sentences maximum).

IMPORTANT: Always include a disclaimer that this is for informational purposes only and users should consult healthcare professionals for medical advice.

Question: ${question}`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 200,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error in answerHealthQuestion:", error);
    return "I'm sorry, I'm having trouble processing your health question at the moment. Please try again later.";
  }
}

export default app;
