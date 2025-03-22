import Project from '../models/Project.js';

/**
 * Create a new project
 */
export const createProject = async (req, res) => {
  try {
    const { userId, name, description, projectData, isPublic, tags } = req.body;
    
    console.log('Creating project:', { userId, name });
    
    if (!userId || !name || !projectData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: userId, name, projectData' 
      });
    }

    // Create a new project with valid fields
    const projectToCreate = {
      userId,
      name,
      projectData
    };
    
    // Add optional fields if they exist
    if (description !== undefined) projectToCreate.description = description;
    if (isPublic !== undefined) projectToCreate.isPublic = isPublic;
    if (tags !== undefined) projectToCreate.tags = tags;

    const project = new Project(projectToCreate);

    await project.save();
    
    console.log('Project created successfully with ID:', project._id);
    
    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Get a project by ID
 */
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    // Validate the id parameter
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID provided'
      });
    }
    
    console.log(`Fetching project with ID: ${id}, requested by user: ${userId}`);
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user has permission to access this project
    if (!project.isPublic && project.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Update a project
 */
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name, description, projectData, isPublic, tags } = req.body;
    
    // Validate the id parameter
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID provided'
      });
    }
    
    console.log(`Updating project with ID: ${id}, requested by user: ${userId}`);
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Verify ownership
    if (project.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Update fields
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (projectData) project.projectData = projectData;
    if (isPublic !== undefined) project.isPublic = isPublic;
    if (tags) project.tags = tags;
    
    await project.save();
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    // Validate the id parameter
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID provided'
      });
    }
    
    console.log(`Deleting project with ID: ${id}, requested by user: ${userId}`);
    
    const project = await Project.findById(id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Verify ownership
    if (project.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    await Project.deleteOne({ _id: id });
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

/**
 * Get all projects for a user
 */
export const getUserProjects = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const projects = await Project.find({ userId })
      .select('_id name description isPublic tags createdAt updatedAt')
      .sort({ updatedAt: -1 });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching user projects:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * List public projects
 */
export const getPublicProjects = async (req, res) => {
  try {
    const { limit = 20, page = 1, sort = 'recent' } = req.query;
    
    const sortOptions = {
      recent: { updatedAt: -1 },
      oldest: { createdAt: 1 },
      nameAsc: { name: 1 },
      nameDesc: { name: -1 }
    };
    
    const projects = await Project.find({ isPublic: true })
      .select('_id name description tags userId createdAt updatedAt')
      .sort(sortOptions[sort] || sortOptions.recent)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));
    
    const total = await Project.countDocuments({ isPublic: true });
    
    res.status(200).json({
      success: true,
      count: projects.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: projects
    });
  } catch (error) {
    console.error('Error fetching public projects:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 