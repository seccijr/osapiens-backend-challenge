import path from 'path';
import 'reflect-metadata';
import { Server } from 'http';
import request from 'supertest';
import express, { Express } from 'express';

// Import database and models
import { AppDataSource } from '../../src/data-source';
import { Task } from '../../src/models/Task';
import { Result } from '../../src/models/Result';
import { Workflow } from '../../src/models/Workflow';

// Import workers, factories, services, controllers
import { TaskWorker } from '../../src/workers/TaskWorker';
import { WorkflowController } from '../../src/controllers/WorkflowController';

import { JobFactory } from '../../src/factories/JobFactory';
import { ResultFactory } from '../../src/factories/ResultFactory';
import { WorkflowFactory, WorkflowStatus } from '../../src/factories/WorkflowFactory';

import { TaskService } from '../../src/services/TaskService';
import { WorkflowService } from '../../src/services/WorkflowService';

// Import routes
import { createRootRouter } from '../../src/routes/RootRoute';
import { createAnalysisRouter } from '../../src/routes/AnalysisRoutes';
import { createWorkflowRouter } from '../../src/routes/WorkflowRoutes';

describe('Polygon Area Workflow E2E Test', () => {
    let app: Express;
    let server: Server;
    let taskWorker: TaskWorker;

    beforeAll(async () => {
        // Set workflow directory environment variable
        process.env.WORKFLOW_DIR = path.join(__dirname, '../data/workflows');

        // Initialize database
        await AppDataSource.initialize();
    });

    afterAll(async () => {
        // Clean up
        if (server) {
            server.close();
        }
        await AppDataSource.destroy();
    });

    beforeEach(async () => {
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
        const jobFactory = new JobFactory(resultsRepository, tasksRepository);
        const resultFactory = new ResultFactory();

        const taskRunner = new TaskService(
            workflowsRepository,
            resultsRepository,
            tasksRepository,
            resultFactory,
            jobFactory
        );

        taskWorker = new TaskWorker(taskRunner, tasksRepository);

        const workflowService = new WorkflowService(
            workflowsRepository,
            tasksRepository,
            resultsRepository
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
    });

    afterEach(() => {
        // Stop server and worker
        if (server) {
            server.close();
        }

        if (taskWorker) {
            taskWorker.stop();
        }
    });

    it('should create a workflow that calculates polygon area correctly', async () => {
        // Sample GeoJSON for a polygon (a 1x1 square)
        const geoJson = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                ]
            }
        };

        // Create the workflow by sending a request to the analysis endpoint
        const createResponse = await request(app)
            .post('/analysis')
            .send({
                clientId: 'test-client',
                geoJson
            });

        expect(createResponse.status).toBe(202);
        const { workflowId } = createResponse.body;
        expect(workflowId).toBeDefined();

        // Poll for workflow completion
        const maxAttempts = 10;

        for (let i = 0; i < maxAttempts; i++) {
            // Wait for tasks to process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check workflow status
            const statusResponse = await request(app).get(`/workflow/${workflowId}/status`);
            expect(statusResponse.status).toBe(200);

            const workflow = statusResponse.body;
            
            if (workflow && workflow.status === WorkflowStatus.Completed) {
                break;
            }
        }

        const resultResponse = await request(app).get(`/workflow/${workflowId}/results`);
        expect(resultResponse.status).toBe(200);

        // Assert that we found our workflow and it's complete
        const workflow = resultResponse.body;
        expect(workflow).toBeDefined();
        expect(workflow.status).toBe(WorkflowStatus.Completed);

        // Assert workflow results
        const finalResult = JSON.parse(workflow.finalResult);
        expect(finalResult).toBeDefined();
        expect(finalResult.success).toBe(true);
        expect(finalResult.tasks.length).toBe(4);
        expect(finalResult.summary.completedTasks).toBe(4);
    });
});