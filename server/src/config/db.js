import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dingplan';
    console.log('Using MongoDB URI starting with:', mongoUri.substring(0, 20) + '...');
    
    const conn = await mongoose.connect(mongoUri);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Set up additional database settings
    mongoose.set('toJSON', {
      virtuals: true,
      transform: (doc, converted) => {
        // Keep _id but provide it also as id for compatibility
        converted.id = converted._id;
        // Only remove version field
        delete converted.__v;
      }
    });
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB; 