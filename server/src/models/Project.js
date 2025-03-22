import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  projectData: {
    type: Object,
    required: [true, 'Project data is required']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: {
    type: [String],
    default: []
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Add an 'id' field that's a string version of _id for easier client-side consumption
      ret.id = ret._id.toString();
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Index for faster queries
ProjectSchema.index({ name: 1 });
ProjectSchema.index({ isPublic: 1 });
ProjectSchema.index({ tags: 1 });
ProjectSchema.index({ updatedAt: -1 });

// Update the updatedAt timestamp on save
ProjectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Ensure projectData has required fields
  if (!this.projectData) {
    this.projectData = { tasks: [], version: '1.0.0' };
  }
  
  // Ensure tags are unique
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = [...new Set(this.tags)];
  }
  
  next();
});

const Project = mongoose.model('Project', ProjectSchema);

export default Project; 