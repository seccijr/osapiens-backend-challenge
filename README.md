# OSApiens Backend Challenge

A robust backend system for handling asynchronous workflows and tasks with support for interdependent task execution, task status management, and result aggregation.

## Table of Contents

- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Features](#features)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/seccijr/osapiens-backend-challenge.git
   cd osapiens-backend-challenge
   ```

2. **Install dependencies:**

   ```bash
   yarn install
   ```

3. **Configure TypeORM:**
   - Edit `data-source.ts` if you need to change database settings

## Running the Application

   ```bash
   yarn start
   ```

   This will start the Express server and background worker after database initialization.

## Features

### Key Components

- **Task & Workflow Entities**: Managed with TypeORM
- **WorkflowFactory**: Creates workflows from YAML configurations
- **TaskService**: Executes jobs and manages task/workflow states
- **Background Worker**: Processes queued tasks asynchronously
- **Dependency Support**: Tasks can depend on outputs from earlier tasks
- **Final Result Aggregation**: Collects and saves final workflow results

### Supported Jobs

1. **Data Analysis**: Analyzes provided geographical data
2. **Email Notification**: Sends notifications about workflow progress
3. **Polygon Area Calculation**: Calculates the area of a provided polygon
4. **Report Generation**: Aggregates outputs from multiple tasks

## API Documentation

### Create a Workflow

**Endpoint:** POST `/analysis`

**Description:** Creates a new workflow with tasks for analyzing geographical data.

**Request:**

```json
{
    "clientId": "client123",
    "geoJson": {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0]
            ]]
        }
    }
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client123",
    "geoJson": {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0]
            ]]
        }
    }
}'
```

### Get Workflow Status

**Endpoint:** GET `/workflow/:id/status`

**Description:** Retrieves the current status of a workflow.

**Response:**

```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "status": "in_progress",
  "completedTasks": 3,
  "totalTasks": 5
}
```

**Example:**

```bash
curl -X GET http://localhost:3000/workflow/3433c76d-f226-4c91-afb5-7dfc7accab24/status
```

### Get Workflow Results

**Endpoint:** GET `/workflow/:id/results`

**Description:** Retrieves the final results of a completed workflow.

**Response:**

```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "status": "completed",
  "finalResult": {
    "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
    "tasks": [
      { "taskId": "task-1-id", "type": "polygonArea", "output": "42.5 sq km" },
      { "taskId": "task-2-id", "type": "dataAnalysis", "output": "Forest coverage: 85%" }
    ],
    "finalReport": "Total area analyzed: 42.5 sq km with 85% forest coverage"
  }
}
```

**Example:**

```bash
curl -X GET http://localhost:3000/workflow/3433c76d-f226-4c91-afb5-7dfc7accab24/results
```

### Response Codes

- **200 OK**: Request successful
- **201 Created**: Resource successfully created
- **400 Bad Request**: Invalid request or workflow not yet completed
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server-side error

## Testing

### Running Unit Tests

```bash
yarn test
```

This command runs all unit tests using Jest, covering individual components like TaskService, WorkflowFactory, and job implementations.

### Running E2E Tests

```bash
yarn run test:e2e
```

This runs end-to-end tests that validate the complete workflow from API request to task execution and result aggregation.

### Manual Testing with Examples

1. **Create a workflow and check logs:**

   ```bash
   # Create a workflow
   curl -X POST http://localhost:3000/analysis \
     -H "Content-Type: application/json" \
     -d '{
        "clientId": "client123",
        "geoJson": {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0]
                ]]
            }
        }
   }'
   
   # Note the returned workflowId, then check its status
   curl -X GET http://localhost:3000/workflow/{workflowId}/status
   
   # Once completed, check the results
   curl -X GET http://localhost:3000/workflow/{workflowId}/results
   ```

2. **Testing workflow with interdependent tasks:**

   Create a workflow that contains tasks with dependencies:

   ```bash
   curl -X POST http://localhost:3000/custom-workflow \
     -H "Content-Type: application/json" \
     -d '{
     "clientId": "client123",
     "workflowDefinition": {
       "name": "dependent_tasks_workflow",
       "steps": [
         {
           "taskType": "polygonArea",
           "stepNumber": 1
         },
         {
           "taskType": "dataAnalysis",
           "stepNumber": 2,
           "dependency": 1
         },
         {
           "taskType": "reportGeneration",
           "stepNumber": 3,
           "dependency": 2
         }
       ]
     },
     "geoJson": {
       "type": "Polygon",
       "coordinates": [[...]]
     }
   }'
   ```

## Project Structure

```
src/
├─ models/
│   ├─ Task.ts           # Task entity definition
│   ├─ Result.ts         # Result entity definition
│   ├─ Workflow.ts       # Workflow entity definition
│
├─ jobs/
│   ├─ Job.ts            # Job interface
│   ├─ DataAnalysisJob.ts      # Analyzes geographical data
│   ├─ EmailNotificationJob.ts  # Sends notifications
│   ├─ PolygonAreaJob.ts        # Calculates polygon area
│   ├─ ReportGenerationJob.ts   # Generates final reports
│
├─ workers/
│   ├─ TaskWorker.ts     # Background worker that polls for queued tasks
│
├─ factories/
│   ├─ JobFactory.ts     # Creates appropriate job instances
│   ├─ ResultFactory.ts  # Creates result objects
│   ├─ WorkflowFactory.ts # Creates workflows from definitions
│
├─ routes/
│   ├─ RootRoute.ts      # Main application routes
│   ├─ AnalysisRoutes.ts # Routes for analysis tasks
│   ├─ WorkflowRoutes.ts # Routes for workflow management
│
├─ controllers/
│   ├─ WorkflowController.ts # Handles workflow-related requests
│
├─ services/
│   ├─ WorkflowService.ts   # Business logic for workflows
│   ├─ TaskService.ts     # Executes jobs and manages task states
│
├─ data-source.ts        # TypeORM database configuration
├─ index.ts              # Application entry point
│
workflows/               # YAML workflow definitions
│
tests/
├─ unit/                 # Unit tests
├─ e2e/                  # End-to-end tests
│
public/                  # Static files
```

