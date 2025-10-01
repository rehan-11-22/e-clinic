import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import fileUpload from "express-fileupload";

// Load environment variables first
dotenv.config();

const app = express();

// Simple CORS - allow all for now
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
  })
);

// Basic middleware
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// File upload middleware
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 50 * 1024 * 1024 },
    abortOnLimit: true,
  })
);

// Health check - this should work first
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Medical Query API!",
    status: "OK",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Medical Query API is running",
    hasOpenAIEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
    hasOpenAIKey: !!process.env.AZURE_OPENAI_KEY,
    hasSQLServer: !!process.env.SQL_SERVER,
  });
});

// Lazy load dependencies
let sql = null;
let AzureOpenAI = null;
let openAIClient = null;
let pool = null;

// Load SQL and OpenAI only when needed
async function initializeDependencies() {
  if (!sql) {
    const sqlModule = await import("mssql");
    sql = sqlModule.default;
  }

  if (!AzureOpenAI) {
    const openaiModule = await import("openai");
    AzureOpenAI = openaiModule.AzureOpenAI;
  }

  if (
    !openAIClient &&
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_KEY
  ) {
    try {
      openAIClient = new AzureOpenAI({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiKey: process.env.AZURE_OPENAI_KEY,
        apiVersion: process.env.AZURE_OPENAI_VERSION || "2024-02-15-preview",
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
      });
      console.log("OpenAI client initialized");
    } catch (error) {
      console.error("Failed to initialize OpenAI:", error.message);
    }
  }
}

// Get SQL pool
async function getPool() {
  if (!pool) {
    await initializeDependencies();

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

    pool = await sql.connect(dbConfig);
    console.log("Database pool created");
  }
  return pool;
}

// API Routes - only load if they exist
try {
  const messageRouter = await import("./router/messageRouter.js");
  app.use("/api/v1/message", messageRouter.default);
} catch (error) {
  console.log("messageRouter not available:", error.message);
}

try {
  const userRouter = await import("./router/userRouter.js");
  app.use("/api/v1/user", userRouter.default);
} catch (error) {
  console.log("userRouter not available:", error.message);
}

try {
  const appointmentRouter = await import("./router/appointmentRouter.js");
  app.use("/api/v1/appointment", appointmentRouter.default);
} catch (error) {
  console.log("appointmentRouter not available:", error.message);
}

try {
  const emailRouter = await import("./router/emailRouter.js");
  app.use("/api/v1/email", emailRouter.default);
} catch (error) {
  console.log("emailRouter not available:", error.message);
}

// Medical Query endpoint
app.post("/api/medical-query", async (req, res) => {
  try {
    await initializeDependencies();

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
        details: "Please check OpenAI configuration.",
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
      details: error.message,
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

Database schema:
- Table 'medical_specialties': id, name, description, created_at
- Table 'doctors': id, firstName, lastName, fullName, specialtyId, experience_years, qualification, is_available, rating, created_at
- Table 'veterinary_doctors': id, firstName, lastName, fullName, specialization, experience_years, qualification, is_available, rating, created_at

SECURITY: Do NOT include sensitive fields (email, phoneNumber, address, city, state, zipCode, consultation_fee)

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

    const prompt = `You are a medical database assistant. Summarize these query results in 2-3 sentences.

The query returned ${resultCount} results.

Original question: ${question}

Results: ${JSON.stringify(results, null, 2)}`;

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

async function answerHealthQuestion(question) {
  try {
    const isMedical = await isMedicalQuestion(question);

    if (!isMedical) {
      return "I'm a medical assistant designed to help with health and medical-related questions only.";
    }

    const prompt = `You are a helpful medical assistant. Answer this health question in 2-3 sentences.

Include a disclaimer about consulting healthcare professionals.

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

// Error handling middleware - load if exists
try {
  const errorMiddlewareModule = await import("./middlewares/error.js");
  app.use(errorMiddlewareModule.errorMiddleware);
} catch (error) {
  console.log("errorMiddleware not available:", error.message);
  // Default error handler
  app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  });
}

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

export default app;
