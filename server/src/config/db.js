import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 */
// Cache the database connection
let cachedConnection = null;

const connectDB = async () => {
  // If the connection is cached, return it
  if (cachedConnection) {
    console.log('Using cached database connection');
    return cachedConnection;
  }
  
  try {
    console.log('Attempting to connect to MongoDB...');
    
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dingplan';
    
    // Mask most of the URI for logging to prevent credential exposure
    const maskedUri = mongoUri.replace(/(mongodb(\+srv)?:\/\/)[^:]+:[^@]+@/, '$1****:****@');
    console.log('Using MongoDB URI starting with:', maskedUri.substring(0, 35) + '...');
    
    // Set up database connection options
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };
    
    // Connect to the database
    const conn = await mongoose.connect(mongoUri, options);
    
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
    
    // Cache the connection
    cachedConnection = conn;
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB:`, error);
    
    // Don't exit process in serverless environment
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    } else {
      throw error; // Rethrow for serverless handler
    }
  }
};

export default connectDB; 