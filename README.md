# OSApiens Backend Challenge

A robust backend system implementing an asynchronous task processing framework with support for complex workflows, dependency management, state transitions, and result aggregation—demonstrating clean architecture principles and design patterns.

## Table of Contents

- [Introduction](#introduction)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Architecture & Design Patterns](#architecture--design-patterns)
- [Task State Machine](#task-state-machine)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Introduction

This project tackles the challenge of building a robust system to handle asynchronous workflows with interdependent tasks. It leverages TypeScript, Express, TypeORM, and follows clean architecture principles to deliver:

- Task scheduling and dependency management
- State machine for reliable task progression
- Asynchronous processing with background workers
- Result aggregation and reporting
- RESTful API for workflow management

## Technology Stack

- **TypeScript** - Strongly typed language
- **Express** - Web framework
- **TypeORM** - ORM for database operations
- **SQLite** - Database (configurable)
- **Jest** - Testing framework
- **YAML** - Workflow definitions

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
   - The system uses SQLite by default for simplicity
   - Edit `data-source.ts` if you need to change database settings
   - Database migrations will run automatically on startup

## Running the Application

Start the application with:

```bash
yarn start
```

This will:
1. Initialize the database
2. Run any pending migrations
3. Start the Express server
4. Launch the background worker for asynchronous task processing

## Architecture & Design Patterns

This project implements several design patterns to achieve clean architecture:

1. **Factory Pattern**:
   - `WorkflowFactory`: Creates workflow instances from configuration
   - `JobFactory`: Instantiates appropriate job implementations
   - `ResultFactory`: Creates standardized result objects

2. **Strategy Pattern**:
   - Jobs implement a common interface but provide different execution strategies
   - Different task types are handled by specialized job implementations

3. **Observer Pattern**:
   - Tasks notify dependents when they complete
   - Event-based workflow progression

4. **State Pattern**:
   - Tasks follow a well-defined state machine (see diagram below)
   - State transitions are strictly controlled and validated

5. **Repository Pattern**:
   - Clean separation between database operations and business logic
   - TypeORM entities provide persistent storage

6. **Service Layer**:
   - `TaskService`: Manages task execution and state transitions
   - `WorkflowService`: Orchestrates workflow creation and monitoring

## Task State Machine

Tasks follow a strict state machine to ensure reliable processing:

```
                                                       ┌─────────────┐ 
                                                       │             │ 
                                       ┌─────────────▶│  COMPLETED  │ 
                                       │               │             │ 
                                       │               └─────────────┘ 
                                       │                               
 ┌──────────┐   ┌──────────┐    ┌──────┴──────┐        ┌─────────────┐ 
 │          │   │          │    │             │        │             │ 
 │  QUEUED  ├─▶│   READY   ├──▶│ IN PROGRESS ├──────▶│   FAILED    │ 
 │          │   │          │    │             │        │             │ 
 └────┬─────┘   └──────────┘    └─────────────┘        └─────────────┘ 
      │                                                                
      │                                                ┌─────────────┐ 
      │                                                │             │ 
      └──────────────────────────────────────────────▶│   SKIPPED   │ 
                                                       │             │ 
                                                       └─────────────┘ 
```

State transitions:
- `QUEUED` - Initial task state upon creation
- `READY` - Task is ready for processing (all dependencies resolved)
- `IN PROGRESS` - Task is actively being processed
- `COMPLETED` - Task has finished successfully
- `FAILED` - Task has encountered an error
- `SKIPPED` - Task could no be executed due to missing dependencies fulfillment

The `TaskService` enforces these transitions.

## API Documentation

### Create an Analysis Workflow

**Endpoint:** POST `/analysis`

**Description:** Creates a new workflow for analyzing geographical data.

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

**Response:**
```json
{
    "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
    "status": "created",
    "message": "Workflow created successfully"
}
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
    "totalTasks": 5,
    "tasks": [
        {
            "id": "task-1",
            "type": "polygonArea",
            "status": "completed"
        },
        {
            "id": "task-2",
            "type": "dataAnalysis",
            "status": "processing"
        }
    ]
}
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
            {
                "taskId": "task-1",
                "type": "polygonArea",
                "output": { "area": 42.5, "unit": "sq km" }
            },
            {
                "taskId": "task-2",
                "type": "dataAnalysis",
                "output": { "forestCoverage": 85, "waterBodies": 2 }
            }
        ],
        "finalReport": "Total area analyzed: 42.5 sq km with 85% forest coverage and 2 water bodies"
    }
}
```

### Response Codes

- **200 OK**: Request successful
- **201 Created**: Resource successfully created
- **400 Bad Request**: Invalid request parameters
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource state conflict (e.g., workflow already completed)
- **500 Internal Server Error**: Server-side error

## Testing

This project was developed using Test-Driven Development (TDD), with tests written before implementation. The test suite covers unit, integration, and end-to-end tests.

### Running Unit Tests

```bash
yarn test tests/unit
```

This runs all unit tests using Jest, covering:
- Service classes (TaskService, WorkflowService)
- Factories (WorkflowFactory, JobFactory, ResultFactory)
- Job implementations
- State machine transitions
- Error handling

### Running End-to-End Tests

```bash
yarn test tests/e2e
```

E2E tests cover the complete flow:
1. API request handling
2. Workflow creation
3. Task queueing and execution
4. Background worker processing
5. State transitions
6. Result aggregation
7. Final response generation

### Manual Testing

For manual testing, use the following curl commands:

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

# Check workflow status (replace with actual workflowId)
curl -X GET http://localhost:3000/workflow/3433c76d-f226-4c91-afb5-7dfc7accab24/status

# Get workflow results when completed
curl -X GET http://localhost:3000/workflow/3433c76d-f226-4c91-afb5-7dfc7accab24/results
```

## Project Structure

```
src/
├─ models/
│   ├─ Task.ts                  # Task entity with state management
│   ├─ Result.ts                # Result entity for storing outputs
│   ├─ Workflow.ts              # Workflow entity representing a job sequence
│
├─ jobs/
│   ├─ Job.ts                   # Job interface defining execution contract
│   ├─ DataAnalysisJob.ts       # Analyzes geographical data
│   ├─ EmailNotificationJob.ts  # Sends notifications
│   ├─ PolygonAreaJob.ts        # Calculates polygon area
│   ├─ ReportGenerationJob.ts   # Generates final reports
│
├─ workers/
│   ├─ TaskWorker.ts            # Background worker that processes queued tasks
│
├─ factories/
│   ├─ JobFactory.ts            # Creates appropriate job instances
│   ├─ ResultFactory.ts         # Creates standardized result objects
│   ├─ WorkflowFactory.ts       # Creates workflows from definitions
│
├─ routes/
│   ├─ RootRoute.ts             # Main application routes
│   ├─ AnalysisRoutes.ts        # Routes for analysis workflows
│   ├─ WorkflowRoutes.ts        # Routes for workflow management
│
├─ controllers/
│   ├─ WorkflowController.ts    # Handles workflow-related requests
│
├─ services/
│   ├─ WorkflowService.ts       # Business logic for workflows
│   ├─ TaskService.ts           # Manages task state transitions
│
├─ data-source.ts               # TypeORM database configuration
├─ index.ts                     # Application entry point
│
workflows/                      # YAML workflow definitions
│
tests/
├─ unit/                        # Unit tests for individual components
├─ e2e/                         # End-to-end API tests
│
public/                         # Static files
```

