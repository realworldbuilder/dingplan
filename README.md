# Construction Planner

A web application for planning and visualizing construction projects.

## Overview

This application helps construction professionals create, visualize, and manage project schedules with an intuitive interface. It features AI assistance for creating task sequences and integrates construction industry best practices.

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Access the application at `http://localhost:3000`

## Key Features

- Interactive timeline visualization
- Task dependency management
- AI-assisted task creation
- Industry-specific templates
- State persistence with LocalStorage

## Project Structure

- `src/` - Application source code
  - `main.ts` - Application entry point
  - `Canvas.ts` - Drawing and UI handling
  - `TaskManager.ts` - Task management
  - `composer/` - AI integration for task creation

## Basic Usage

1. Apply a WBS template to create swimlanes
2. Add task sequences to swimlanes
3. Customize tasks as needed
4. View and manage dependencies
5. Export or save your project 