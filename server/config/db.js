import mongoose from 'mongoose';
import dns from 'node:dns';

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kharcha';
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    dns.setServers(dnsServers);
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Retry connection automatically
    setTimeout(connectDB, 5000);
  }
};
