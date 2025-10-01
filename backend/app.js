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

// SQL Server configuration - singleton connection pool
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

// Singleton SQL pool for serverless
let sqlPool = null;
const getSqlPool = async () => {
  if (!sqlPool) {
    try {
      sqlPool = await sql.connect(dbConfig);
      console.log("SQL Server connection pool created");
    } catch (err) {
      console.error("Failed to create SQL pool:", err);
      sqlPool = null;
      throw err;
    }
  }
  return sqlPool;
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

// API Routes - TEMPORARILY COMMENTED OUT FOR TESTING
// app.use("/api/v1/message", messageRouter);
// app.use("/api/v1/user", userRouter);
// app.use("/api/v1/appointment", appointmentRouter);
// app.use("/api/v1/email", emailRouter);

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

// Error handling middleware
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

// Determine whether the question is a database query or a health query
async function classifyQuestion(question) {
  try {
    const isMedical = await isMedicalQuestion(question);

    if (!isMedical) {
      return "non-medical";
    }

    const prompt = `You are an expert in medical software and healthcare knowledge. Your task is to classify the following medical/health question.

Respond only with:
- "database" if the question should be answered using a SQL query from a medical database
- "health" if the question is about general health knowledge

Examples of database questions: "How many cardiologists are available?", "Show me appointments for today"
Examples of health questions: "What are symptoms of diabetes?", "How is hypertension treated?"

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

// Function to convert English to SQL
async function englishToSql(question) {
  try {
    const prompt = `You are a medical database expert. Convert this English question to SQL Server T-SQL.

Database schema for E-Cure-Hub:

  - Table 'medical_specialties':
    * id, name, description, created_at

  - Table 'doctors':
    * id, firstName, lastName, fullName, specialtyId, experience_years, qualification, is_available, rating, created_at
    
    IMPORTANT: Do NOT include or query: email, phoneNumber, address, city, state, zipCode, consultation_fee

  - Table 'veterinary_doctors':
    * id, firstName, lastName, fullName, specialization, experience_years, qualification, is_available, rating, created_at
    
    IMPORTANT: Do NOT include or query: email, phoneNumber, address, city, state, zipCode, consultation_fee

SECURITY RULES:
1. NEVER include sensitive fields
2. Use SQL Server T-SQL syntax only

Only respond with the SQL query.

Question: ${question}`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 500,
    });

    let sqlQuery = response.choices[0].message.content.trim();
    sqlQuery = sqlQuery.replace(/```sql\s*/g, "").replace(/```\s*/g, "");

    // Remove sensitive fields
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

// Function to execute SQL query - using singleton pool
async function runQuery(sqlQuery) {
  try {
    const pool = await getSqlPool();
    const result = await pool.request().query(sqlQuery);
    return result.recordset || [];
  } catch (err) {
    console.error("SQL Server error:", err);
    throw new Error(`Database query failed: ${err.message}`);
  }
}

// Function to generate a natural language summary
async function generateResultSummary(question, results) {
  try {
    const resultCount = Array.isArray(results) ? results.length : 0;

    const prompt = `You are a medical database assistant. Summarize these query results clearly.

IMPORTANT: There are ${resultCount} results.

Original question: ${question}
Results: ${JSON.stringify(results, null, 2)}

Provide a brief summary (2-3 sentences) that:
1. States there are ${resultCount} results
2. Answers the question directly
3. Highlights key information

Keep it concise and natural.`;

    const response = await openAIClient.chat.completions.create({
      model: "gpt-35-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 150,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error in generateResultSummary:", error);
    const resultCount = Array.isArray(results) ? results.length : 0;
    return `Found ${resultCount} results for your query.`;
  }
}

// Function to answer general health questions
async function answerHealthQuestion(question) {
  try {
    const isMedical = await isMedicalQuestion(question);

    if (!isMedical) {
      return "I'm a medical assistant designed to help with health and medical-related questions only.";
    }

    const prompt = `You are a helpful medical assistant. Answer this health question clearly and concisely.

Keep responses brief (2-3 sentences).
Always include a disclaimer about consulting healthcare professionals.

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
    return "I'm having trouble processing your question. Please try again.";
  }
}

export default app;
