import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import projectRoutes from './routes/projectRoutes.js';
import connectDB from './config/db.js';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
try {
  connectDB().catch(err => {
    console.error('Failed to connect to MongoDB:', err);
  });
} catch (error) {
  console.error('Error during MongoDB connection setup:', error);
}

// Enhanced CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', // Allow from any origin by default
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Log server start info
console.log('Starting server with:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '15mb' })); // Increased limit for larger project files
app.use(bodyParser.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root API route for debugging
app.get('/api', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API is running',
    endpoints: {
      health: '/api/health',
      projects: '/api/projects'
    }
  });
});

// Routes
app.use('/api/projects', projectRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  console.error(err.stack);
  
  // Detailed error for debugging
  const errorDetails = process.env.NODE_ENV === 'production' 
    ? 'Server error' 
    : err.message || 'Unknown error';
    
  res.status(500).json({
    success: false,
    message: 'Server error',
    details: errorDetails
  });
});

// In a non-serverless environment, start the server normally
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the Express API for serverless environments like Vercel
export default app; 