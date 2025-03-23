import express from 'express';
import {
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getUserProjects,
  getPublicProjects,
  importProject
} from '../controllers/projectController.js';

const router = express.Router();

// Project routes
router.post('/', createProject);
router.post('/import', importProject);
router.get('/user/:userId', getUserProjects);
router.get('/public', getPublicProjects);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router; 