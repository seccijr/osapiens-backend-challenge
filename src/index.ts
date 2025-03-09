import 'reflect-metadata';
import express from 'express';


import { Task } from './models/Task';
import { Result } from './models/Result';
import { Workflow } from './models/Workflow';
import { AppDataSource } from './data-source';

import { TaskWorker } from './workers/TaskWorker';
import { TaskRunner } from './workers/TaskRunner';

import { JobFactory } from './factories/JobFactory';
import { WorkflowFactory } from './factories/WorkflowFactory';

import { createRootRouter } from './routes/RootRoute';
import { createAnalysisRouter } from './routes/WorkflowRoutes';


// Dependency resolution
const resultsRepository = AppDataSource.getRepository(Result);
const tasksRepository = AppDataSource.getRepository(Task);
const workflowsRepository = AppDataSource.getRepository(Workflow);
const workflowFactory = new WorkflowFactory(workflowsRepository, tasksRepository);

const jobFactory = new JobFactory(resultsRepository, tasksRepository);
const taskRunner = new TaskRunner(tasksRepository, jobFactory);
const taskWorker = new TaskWorker(taskRunner, tasksRepository);


// Dependency injection
const app = express();
app.use(express.json());
app.use('/', createRootRouter());
app.use('/analysis', createAnalysisRouter(workflowFactory));

AppDataSource.initialize()
    .then(() => {
        // Start the worker after successful DB connection
        taskWorker.pool();

        app.listen(3000, () => {
            console.log('Server is running at http://localhost:3000');
        });
    })
    .catch((error) => console.log(error));
