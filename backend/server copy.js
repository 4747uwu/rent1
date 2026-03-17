import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression'; 
import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
import http from 'http';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import superadminRoutes from './routes/superadmin.routes.js';
import orthancRoutes from './routes/ingestion.routes.js';
import adminRoutes from './routes/admin.routes.js'; 
import assignerRoutes from './routes/assigner.routes.js';
import dataExtractionRoutes from './routes/dataExtraction.routes.js'; 
import groupRoutes from './routes/groupUserManagement.routes.js'; // ✅ NEW GROUP ROUTES
import doctorRoutes from './routes/doctor.routes.js'
import typistRoutes from './routes/typist.routes.js';
import verifierRoutes from './routes/verifier.routes.js';
import doctorTemplateRoutes from './routes/doctorTemplate.routes.js';
import reportStoringRoutes from './routes/reportStoring.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import htmlTemplateRoutes from './routes/htmlTemplate.routes.js';
import studyNotesRoutes from './routes/studyNotes.routes.js'; // ✅ ADD THIS LINE
import labRoutes from './routes/lab.routes.js';
import downloadRoutes from './routes/download.routes.js'
import studyCopyRoutes from './routes/studyCopy.routes.js';









dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ✅ ADD BODY PARSING MIDDLEWARE
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

app.use((req, res, next) => {
    // Remove server fingerprinting
    res.removeHeader('X-Powered-By');
    
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // HSTS in production
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    next();
});

const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? [
        'http://64.227.187.164',        // ✅ CHANGE from 157.245.86.199
        'https://64.227.187.164',       // ✅ HTTPS version
        process.env.FRONTEND_URL,       // ✅ Environment variable fallback
        'http://localhost',             // ✅ Local testing
        'https://localhost',   
        'http://portal.xcentic.in',     
        'https://portal.xcentic.in',
        'http://ai.starradiology.com',
        'http://157.245.86.199',
        'http://165.232.189.64'
               // ✅ Local HTTPS testing
      ]
    : [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:5173', // Vite dev server
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://64.227.187.164',        // ✅ CHANGE from 157.245.86.199
        'https://64.227.187.164',
        'http://portal.xcentic.in',     
        'https://portal.xcentic.in',
        'http://ai.starradiology.com',
        'http://157.245.86.199',
                'http://165.232.189.64'

      ];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            console.log(`✅ CORS allowed origin: ${origin}`);
            callback(null, true);
        } else {
            console.warn(`🚨 CORS blocked origin: ${origin}`);
            callback(new Error(`Not allowed by CORS: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control'
    ],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400
}));

// ✅ 6. HEALTH CHECK ENDPOINTS
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    });
});

app.get('/ready', async (req, res) => {
    try {
        // Add your readiness checks here
        res.status(200).json({ 
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'not ready', 
            error: error.message 
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'DICOM Workflow API is running!',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/orthanc', orthancRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assigner', assignerRoutes);
app.use('/api/data-extraction', dataExtractionRoutes); // ✅ NEW DATA EXTRACTION ROUTES
app.use('/api/group', groupRoutes); // ✅ NEW GROUP ROUTES
app.use('/api/doctor', doctorRoutes);
app.use('/api/typist', typistRoutes);
app.use('/api/verifier', verifierRoutes);
app.use('/api/doctor/templates', doctorTemplateRoutes);
app.use('/api/reports', reportStoringRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/html-templates', htmlTemplateRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/study-copy', studyCopyRoutes);
// ...existing code...


// ...existing code...

app.use('/api/study-notes', studyNotesRoutes); // ✅ ADD THIS LINE

// ...existing code...




server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});




