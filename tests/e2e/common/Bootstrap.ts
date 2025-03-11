import path from 'path';
import 'reflect-metadata';
import { Server } from 'http';
import express, { Express } from 'express';

// Import database and models
import { AppDataSource } from './data-source';
import { Task } from '../../../src/models/Task';
import { Result } from '../../../src/models/Result';
import { Workflow } from '../../../src/models/Workflow';

// Import workers, factories, services, controllers
import { TaskWorker } from '../../../src/workers/TaskWorker';
import { WorkflowController } from '../../../src/controllers/WorkflowController';

import { JobFactory } from '../../../src/factories/JobFactory';
import { ResultFactory } from '../../../src/factories/ResultFactory';
import { WorkflowFactory } from '../../../src/factories/WorkflowFactory';

import { TaskService } from '../../../src/services/TaskService';
import { WorkflowService } from '../../../src/services/WorkflowService';

// Import routes
import { createRootRouter } from '../../../src/routes/RootRoute';
import { createAnalysisRouter } from '../../../src/routes/AnalysisRoutes';
import { createWorkflowRouter } from '../../../src/routes/WorkflowRoutes';

let app: Express;
let server: Server;
let taskWorker: TaskWorker;

export const e2eBeforeAll = async () => {

    // Set workflow directory environment variable
    process.env.WORKFLOW_DIR = path.join(__dirname, '../../data/workflows');

    // Initialize database
    await AppDataSource.initialize();
};

export const e2eAfterAll = async () => {
    // Clean up
    if (server) {
        server.close();
    }
    await AppDataSource.destroy();
};

export const e2eBeforeEach = async () => {
    // Reset database
    await AppDataSource.synchronize(true);

    // Create Express app with the same configuration as in index.ts
    app = express();
    app.use(express.json());

    // Set up repositories
    const resultsRepository = AppDataSource.getRepository(Result);
    const tasksRepository = AppDataSource.getRepository(Task);
    const workflowsRepository = AppDataSource.getRepository(Workflow);

    // Set up factories, services, workers and controllers
    const workflowFactory = new WorkflowFactory(workflowsRepository, tasksRepository);
    const jobFactory = new JobFactory(resultsRepository, tasksRepository, workflowsRepository);
    const resultFactory = new ResultFactory();

    const taskService = new TaskService(
        workflowsRepository,
        resultsRepository,
        tasksRepository,
        resultFactory,
        jobFactory
    );

    taskWorker = new TaskWorker(taskService);

    const workflowService = new WorkflowService(
        workflowsRepository,
        tasksRepository
    );

    const workflowController = new WorkflowController(workflowService, workflowFactory);

    // Set up routes
    app.use('/', createRootRouter());
    app.use('/analysis', createAnalysisRouter(workflowController));
    app.use('/workflow', createWorkflowRouter(workflowController));

    // Start task worker
    taskWorker.pool();

    // Start server
    server = app.listen(3001); // Using a different port from the main app

    return app;
};

export const e2eAfterEach = async () => {
    // Stop server and worker
    if (server) {
        server.close();
    }

    if (taskWorker) {
        taskWorker.stop();
    }
};