import express from "express";
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

// Global connection pool (reused across invocations)
let pool = null;

// Initialize OpenAI client
let openAIClient = null;

const initializeOpenAI = () => {
  try {
    if (
      !openAIClient &&
      process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_KEY
    ) {
      openAIClient = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_KEY,
        apiVersion: process.env.AZURE_OPENAI_VERSION || "2024-02-15-preview",
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      });
      console.log("OpenAI client initialized successfully");
    }
  } catch (error) {
    console.error("Failed to initialize OpenAI client:", error);
  }
};

// SQL Server configuration
const dbConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: true,
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

// Get or create SQL connection pool
async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(dbConfig);
      console.log("Database pool created");
    } catch (err) {
      console.error("Database connection failed:", err);
      throw err;
    }
  }
  return pool;
}

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

// File upload middleware - serverless compatible
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 50 * 1024 * 1024 },
    abortOnLimit: true,
    createParentPath: true,
    safeFileNames: true,
    preserveExtension: true,
  })
);

// Health check endpoint
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
    // Initialize OpenAI if not already done
    if (!openAIClient) {
      initializeOpenAI();
    }

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

    if (!openAIClient) {
      return res.status(500).json({
        error: "OpenAI service not available",
        details:
          "OpenAI client initialization failed. Please check configuration.",
      });
    }

    const classification = await classifyQuestion(question.trim());

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
        const sqlQuery = await englishToSql(question);
        let results;
        let answer;

        try {
          results = await runQuery(sqlQuery);
          answer = await generateResultSummary(question, results);

          return res.json({
            type: "database",
            question,
            sql: sqlQuery,
            results,
            answer,
            tab: "results",
          });
        } catch (sqlError) {
          console.error("SQL Error:", sqlError);
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
        const answer = await answerHealthQuestion(question);
        return res.json({
          type: "health",
          question,
          answer,
          tab: "chat",
        });
      }
    } else {
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

// Helper Functions

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
    return true;
  }
}

async function classifyQuestion(question) {
  try {
    const isMedical = await isMedicalQuestion(question);

    if (!isMedical) {
      return "non-medical";
    }

    const prompt = `You are an expert in medical software and healthcare knowledge. Your task is to classify the following medical/health question.

Respond only with:
- "database" if the question should be answered using a SQL query from a medical database (like finding doctors, appointments, diseases, symptoms data),
- "health" if the question is about general health knowledge, medical conditions, treatments, or educational medical content.

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
    return "health";
  }
}

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
    * id, firstName, lastName, fullName, specialization, experience_years, qualification, is_available, rating, created_at
    
    IMPORTANT: Do NOT include sensitive fields

IMPORTANT SECURITY RULES:
1. NEVER include sensitive doctor information
2. Use SQL Server T-SQL syntax

Only respond with the SQL query, nothing else.

Question: ${question}`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 500,
    });

    let sqlQuery = response.choices[0].message.content.trim();
    sqlQuery = sqlQuery.replace(/```sql\s*/g, "").replace(/```\s*/g, "");

    // Clean sensitive fields
    sqlQuery = sqlQuery.replace(
      /,\s*(email|phoneNumber|address|city|state|zipCode|consultation_fee)\b/gi,
      ""
    );
    sqlQuery = sqlQuery.replace(
      /\b(email|phoneNumber|address|city|state|zipCode|consultation_fee)\s*,/gi,
      ""
    );

    return sqlQuery;
  } catch (error) {
    console.error("Error in englishToSql:", error);
    throw new Error("Failed to generate SQL query");
  }
}

async function runQuery(sqlQuery) {
  try {
    const currentPool = await getPool();
    const result = await currentPool.request().query(sqlQuery);
    return result.recordset || [];
  } catch (err) {
    console.error("SQL Server error:", err);
    throw new Error(`Database query failed: ${err.message}`);
  }
}

async function generateResultSummary(question, results) {
  try {
    const resultCount = Array.isArray(results) ? results.length : 0;

    const prompt = `You are a medical database assistant. Summarize these query results in a clear, concise way.

IMPORTANT: The actual number of results is ${resultCount}.

Original question: ${question}

Query results:
${JSON.stringify(results, null, 2)}

Provide a brief summary (2-3 sentences) that states there are ${resultCount} results and highlights key findings.`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 150,
    });

    let summary = response.choices[0].message.content.trim();
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

async function answerHealthQuestion(question) {
  try {
    const isMedical = await isMedicalQuestion(question);

    if (!isMedical) {
      return "I'm a medical assistant designed to help with health and medical-related questions only. Please ask about medical conditions, symptoms, treatments, healthcare providers, or other health-related topics.";
    }

    const prompt = `You are a helpful medical assistant. Answer the following health question in 2-3 sentences.

IMPORTANT: Include a disclaimer that this is for informational purposes only and users should consult healthcare professionals for medical advice.

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

// Error handling middleware
app.use(errorMiddleware);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

export default app;
