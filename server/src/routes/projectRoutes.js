import express from 'express';
import {
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getUserProjects,
  getPublicProjects
} from '../controllers/projectController.js';

const router = express.Router();

// Project routes
router.post('/', createProject);
router.get('/public', getPublicProjects);
router.get('/user/:userId', getUserProjects);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router; 