import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dingplan', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
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