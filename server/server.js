import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploaded files
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Routes (supports both /api/* and direct /* endpoints)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/categories', categoryRoutes);
app.use('/categories', categoryRoutes);

app.use('/api/expenses', expenseRoutes);
app.use('/expenses', expenseRoutes);

app.use('/api/profile', profileRoutes);
app.use('/profile', profileRoutes);

app.use('/api/backup', backupRoutes);
app.use('/backup', backupRoutes);

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'OK', message: 'Kharcha API server is running smooth' });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Kharcha server running on http://localhost:${PORT}`);
});
