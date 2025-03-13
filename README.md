# Construction Planner

A web application for planning and visualizing construction projects.

## Features

- Interactive task timeline visualization
- Resource allocation and planning
- Task dependency management
- Project composition tools
- Adaptive PDF export with Dingplan branding
- LocalStorage persistence for saving project state

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

### Build

Build for production:
```bash
npm run build
```

## Development Guide

### Project Structure

- `src/` - Application source code
  - `main.ts` - Application entry point
  - `Canvas.ts` - Main drawing logic and UI handling
  - `TaskManager.ts` - Task and swimlane management
  - `Task.ts` - Definition of task object properties and methods
  - `composer/` - Task composer components
    - `Composer.ts` - LLM integration for task creation
    - `Templates.ts` - Construction sequence templates
  - `utils/` - Utility functions
    - `localStorage.ts` - State persistence logic
- `public/` - Static assets

### Development Workflow

1. **Local development**
   - The application will be available at `http://localhost:3000` (or another port if 3000 is in use)
   - Changes to source files will automatically trigger rebuilds
   - The browser will update in real-time thanks to Vite's HMR (Hot Module Replacement)

2. **Code organization**
   - Core application logic is in TypeScript files in the `src` directory
   - Task management is handled primarily through `TaskManager.ts`
   - Canvas rendering is managed by `Canvas.ts`
   - Construction templates are defined in `src/composer/Templates.ts`

3. **Testing changes**
   - Make changes to the relevant files
   - The development server will automatically refresh to reflect your changes
   - Use browser developer tools to debug any issues

### Making Changes

1. **Edit files**
   - Modify TypeScript files in the `src` directory
   - Key files include:
     - `src/main.ts` - Application entry point
     - `src/Canvas.ts` - Main drawing logic and UI handling
     - `src/TaskManager.ts` - Task and swimlane management
     - `src/composer/Templates.ts` - Construction sequence templates

2. **Implement new features**
   - Add new task management functionality in `TaskManager.ts`
   - Create new construction templates in `src/composer/Templates.ts`
   - Add UI components in the appropriate files

3. **Persistence functionality**
   - State persistence is managed through `src/utils/localStorage.ts`
   - Any new state that needs to be persisted should be added here

### Common Tasks

1. **Adding a new construction template**
   - Open `src/composer/Templates.ts`
   - Create a new template function following the existing pattern
   - Register it in the TEMPLATES collection

2. **Modifying task appearance or behavior**
   - Edit `src/Task.ts` to change the core task properties and behavior
   - Edit `src/TaskManager.ts` to modify how tasks are managed, positioned, and interact

3. **Changing the UI layout**
   - Most UI components are rendered through `Canvas.ts`
   - Sidebar and panel layouts can be modified in the relevant files

4. **Debugging**
   - Use `src/utils/logger.ts` for logging during development
   - Check browser console for any errors or warnings

### Deployment

1. **Build for production**
   ```bash
   npm run build
   ```
   This creates optimized files in the `dist` directory

2. **Preview the production build**
   ```bash
   npm run preview
   ```

3. **Deploy to Vercel**
   - The project includes Vercel configuration in `vercel.json`
   - When pushing changes to the main branch, Vercel will automatically deploy

## Recent Features

- **LocalStorage persistence** for saving application state between sessions
- **Substation Build-Out Sequence** template for electrical construction projects
- **Adaptive PDF export** with Dingplan branding
- **Improved swimlane label alignment** for better visual hierarchy
- **Trade filtering** for showing/hiding tasks by trade category
- **Dependency visualization** toggle with the 'D' key 