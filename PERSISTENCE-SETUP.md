# DingPlan Storage Architecture

This document outlines the storage mechanisms used in the DingPlan construction planning application.

## Overview

The application uses a tiered storage approach with the following components:

1. **Project-Specific State Storage** - For saving Canvas state (tasks, swimlanes, camera position)
2. **Project Metadata Storage** - For project listing and management 
3. **Backup System** - For point-in-time recovery
4. **Mock API Service** - For simulating server-side storage

## Storage Keys and Isolation

The application uses the following localStorage keys:

- `dingplan_state_[projectId]` - Project-specific canvas state
- `dingplan_projects` - List of all projects (metadata + data)
- `backup-[timestamp]` - Project backups

## Component Responsibilities

### Canvas.ts

- Saves and loads state for the current project only
- Uses the ProjectManager's currentProjectId for isolation
- Never loads state on startup unless a project ID is present in the URL
- Provides clearCanvas() method to reset state

### ProjectManager.ts

- Manages the currentProjectId
- Coordinates loading/saving projects to the mock API
- Handles backups for the current project
- Provides UI for project management
- Updates URL with current project ID

### localStorage.ts Utility

- Provides project-aware save/load functions
- Handles proper serialization of dates and other objects
- Provides clearAllAppData utility for complete reset

### projectService.ts

- Implements a mock API service using localStorage
- Handles project CRUD operations
- Manages project metadata and access controls
- Will be replaced with real API implementation in the future

## Storage Lifecycle

1. **Initial Load**
   - Check for project ID in URL
   - Only load state if project ID is present
   - Otherwise, start with empty canvas

2. **Project Loading**
   - When a project is selected, load from the mock API
   - Set the currentProjectId
   - Update URL with project ID parameter
   - Load project-specific state

3. **Auto-Save**
   - Periodically save state to project-specific localStorage
   - Save changes when tasks are modified
   - Save before page unload

4. **Project Creation**
   - Create new project in mock API
   - Generate new project ID
   - Update URL
   - Clear canvas state
   - Begin auto-saving to new project key

5. **Backup System**
   - Creates point-in-time snapshots
   - Stores project-specific backups
   - Limits number of backups to prevent localStorage overflow
   - Provides restoration of previous states

## Implementation Details

### Project Isolation

Each project's data is isolated using the following pattern:
```typescript
const storageKey = projectId ? `${BASE_STORAGE_KEY}_${projectId}` : BASE_STORAGE_KEY;
localStorage.setItem(storageKey, serializedState);
```

### Date Serialization

Dates are properly serialized/deserialized using a custom replacer:
```typescript
JSON.stringify(state, (key, value) => {
  if (value instanceof Date) {
    return { __type: 'Date', value: value.toISOString() };
  }
  return value;
});
```

### Race Condition Prevention

Canvas initialization and ProjectManager initialization are sequenced to prevent race conditions:
```typescript
// Canvas constructor
this.projectManager = new ProjectManager();
// ... other initialization ...
this.projectManager.init(this); // Initialize after canvas is fully ready
```

## Future Improvements

1. **Server-Side Storage**: Replace mock API with real server endpoints
2. **Offline Support**: Implement proper offline-first architecture with sync
3. **Conflict Resolution**: Add merge capabilities for concurrent edits
4. **Encryption**: Add client-side encryption for sensitive project data
5. **Storage Quotas**: Add monitoring of localStorage usage and warnings
