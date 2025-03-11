import { Repository } from 'typeorm';

import { Job } from '../../../src/jobs/Job';

import { Task } from '../../../src/models/Task';
import { Workflow } from '../../../src/models/Workflow';

import { JobFactory } from '../../../src/factories/JobFactory';
import { WorkflowStatus } from '../../../src/factories/WorkflowFactory';

import { TaskService, TaskStatus } from '../../../src/services/TaskService';
import { Result } from '../../../src/models/Result';
import { ResultFactory } from '../../../src/factories/ResultFactory';

describe('TaskService with dependencies', () => {
    const clientId = 'test-client-id';

    let mockJob: Job;
    let taskService: TaskService;
    let mockJobFactory: JobFactory;
    let mockResultFactory: ResultFactory;
    let mockTaskRepository: Repository<Task>;
    let mockResultRepository: Repository<Result>;
    let mockWorkflowRepository: Repository<Workflow>;

    beforeEach(() => {
        mockJob = {
            run: jest.fn().mockImplementation(task => Promise.resolve(task.result)),
        };

        mockJobFactory = {
            createJobFromTaskType: jest.fn().mockReturnValue(mockJob),
        } as unknown as JobFactory;

        mockResultFactory = {
            createResult: jest.fn().mockImplementation(() => Promise.resolve({})),
        } as unknown as ResultFactory;

        mockTaskRepository = {
            save: jest.fn().mockImplementation(task => Promise.resolve(task)),
            findOne: jest.fn(),
            find: jest.fn(),
            findBy: jest.fn()
        } as unknown as Repository<Task>;

        mockResultRepository = {
            save: jest.fn().mockImplementation(result => Promise.resolve(result)),
            findOne: jest.fn(),
            findBy: jest.fn()
        } as unknown as Repository<Result>;

        mockWorkflowRepository = {
            save: jest.fn().mockImplementation(task => Promise.resolve(task)),
            findOne: jest.fn(),
        } as unknown as Repository<Workflow>;

        taskService = new TaskService(mockWorkflowRepository, mockResultRepository, mockTaskRepository, mockResultFactory, mockJobFactory);
    });

    describe('run', () => {
        it('should execute tasks that are in Ready status', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow-id',
                clientId: clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const task = {
                taskId: 'ready-task',
                status: TaskStatus.Ready, // Task is already in Ready status
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 2,
                taskType: 'taskType',
                workflow: workflow,
            } as Task;

            const result = {
                resultId: 'result-id',
                data: { someData: 'test data' }
            };

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(workflow);
            (mockResultFactory.createResult as jest.Mock).mockResolvedValue(result);

            // Act
            await taskService.run(task);

            // Assert
            expect(mockJob.run).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'ready-task',
            }));
        });

        it('should not execute tasks that are not in Ready status', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow-id',
                clientId: clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const task = {
                taskId: 'queued-task',
                status: TaskStatus.Queued, // Not Ready
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 2,
                taskType: 'taskType',
                workflow: workflow,
            } as Task;

            // Act & Assert
            await expect(taskService.run(task)).rejects.toThrow(`Task ${task.taskId} is not ready to run`);
        });
    });

    describe('prepare', () => {
        it('should set task to Ready when all previous steps and dependencies are completed', async () => {
            // Arrange
            const workflow = {
                workflowId: 'workflow-1',
                clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const task1 = {
                taskId: 'task-1',
                stepNumber: 1,
                status: TaskStatus.Completed,
                geoJson: JSON.stringify({}),
                taskType: 'independentTaskType',
                workflow,
                clientId,
            } as Task;

            const task2 = {
                taskId: 'task-2',
                stepNumber: 2,
                status: TaskStatus.Completed,
                geoJson: JSON.stringify({}),
                taskType: 'independentTaskType',
                workflow,
                clientId,
            } as Task;

            const currentTask = {
                taskId: 'task-3',
                stepNumber: 3,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                taskType: 'dependentTaskType',
                workflow,
                clientId,
                dependencies: [task1, task2]
            } as Task;

            workflow.tasks = [task1, task2, currentTask];

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(workflow);

            // Act
            await taskService.prepare(currentTask);

            // Assert
            expect(mockTaskRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-3',
                status: TaskStatus.Ready
            }));
        });

        it('should set task to Queued when previous steps are not all completed', async () => {
            // Arrange
            const workflow = {
                workflowId: 'workflow-1',
                clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const task1 = {
                taskId: 'task-1',
                stepNumber: 1,
                status: TaskStatus.Completed,
                geoJson: JSON.stringify({}),
                taskType: 'independentTaskType',
                workflow,
                clientId,
            } as Task;

            const task2 = {
                taskId: 'task-2',
                stepNumber: 2,
                status: TaskStatus.InProgress,
                geoJson: JSON.stringify({}),
                taskType: 'independentTaskType',
                workflow,
                clientId,
            } as Task;

            const currentTask = {
                taskId: 'task-3',
                stepNumber: 3,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                taskType: 'dependentTaskType',
                workflow,
                clientId,
                dependencies: [task1]
            } as Task;

            workflow.tasks = [task1, task2, currentTask];

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(workflow);

            // Act
            await taskService.prepare(currentTask);

            // Assert
            expect(mockTaskRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-3',
                status: TaskStatus.Queued
            }));
        });

        it('should set task to Skipped when any dependency has failed', async () => {
            // Arrange
            const workflow = {
                workflowId: 'workflow-1',
                clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const task1 = {
                taskId: 'task-1',
                stepNumber: 1,
                status: TaskStatus.Completed,
                geoJson: JSON.stringify({}),
                taskType: 'independentTaskType',
                workflow,
                clientId,
            } as Task;

            const task2 = {
                taskId: 'task-2',
                stepNumber: 2,
                status: TaskStatus.Failed,
                geoJson: JSON.stringify({}),
                taskType: 'independentTaskType',
                workflow,
                clientId,
            } as Task;

            const currentTask = {
                taskId: 'task-3',
                stepNumber: 3,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                taskType: 'dependentTaskType',
                workflow,
                clientId,
                dependencies: [task1, task2]
            } as Task;

            workflow.tasks = [task1, task2, currentTask];

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(workflow);

            // Act
            await taskService.prepare(currentTask);

            // Assert
            expect(mockTaskRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-3',
                status: TaskStatus.Skipped
            }));
        });

        it('should set task to Ready when all dependencies are completed', async () => {
            // Arrange
            const workflow = {
                workflowId: 'workflow-1',
                clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const taskA = {
                taskId: 'task-a',
                stepNumber: 1,
                status: TaskStatus.Completed,
                geoJson: JSON.stringify({}),
                taskType: 'typeA',
                workflow,
                clientId,
            } as Task;

            const taskB = {
                taskId: 'task-b',
                stepNumber: 1,
                status: TaskStatus.Completed,
                geoJson: JSON.stringify({}),
                taskType: 'typeB',
                workflow,
                clientId,
            } as Task;

            const taskC = {
                taskId: 'task-c',
                stepNumber: 2,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                taskType: 'typeC',
                workflow,
                clientId,
                dependencies: [taskA, taskB]
            } as Task;

            workflow.tasks = [taskA, taskB, taskC];

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(workflow);

            // Act
            await taskService.prepare(taskC);

            // Assert
            expect(mockTaskRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-c',
                status: TaskStatus.Ready
            }));
        });

        it('should set task to Queued when dependencies are not all completed', async () => {
            // Arrange
            const workflow = {
                workflowId: 'workflow-1',
                clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const taskA = {
                taskId: 'task-a',
                stepNumber: 1,
                status: TaskStatus.Completed,
                geoJson: JSON.stringify({}),
                taskType: 'typeA',
                workflow,
                clientId,
            } as Task;

            const taskB = {
                taskId: 'task-b',
                stepNumber: 1,
                status: TaskStatus.InProgress,
                geoJson: JSON.stringify({}),
                taskType: 'typeB',
                workflow,
                clientId,
            } as Task;

            const taskC = {
                taskId: 'task-c',
                stepNumber: 2,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                taskType: 'typeC',
                workflow,
                clientId,
                dependencies: [taskA, taskB]
            } as Task;

            workflow.tasks = [taskA, taskB, taskC];

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(workflow);

            // Act
            await taskService.prepare(taskC);

            // Assert
            expect(mockTaskRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-c',
                status: TaskStatus.Queued
            }));
        });
    });

    describe('getReadyTasks', () => {
        it('should return tasks with Ready status', async () => {
            // Arrange
            const readyTask = {
                taskId: 'ready-task',
                status: TaskStatus.Ready
            } as Task;

            (mockTaskRepository.find as jest.Mock).mockResolvedValue([readyTask]);

            // Act
            const result = await taskService.getReadyTasks();

            // Assert
            expect(result).toEqual([readyTask]);
            expect(mockTaskRepository.find).toHaveBeenCalledWith({
                where: { status: TaskStatus.Ready },
                relations: ['dependencies', 'workflow']
            });
        });
    });

    describe('getDependenciesResults', () => {
        it('should fetch result IDs for all dependencies', async () => {
            // Arrange
            const workflow = { workflowId: 'workflow-1' } as Workflow;

            const dep1 = {
                taskId: 'dep-1',
                resultId: 'result-1',
            } as Task;

            const dep2 = {
                taskId: 'dep-2',
                resultId: 'result-2',
            } as Task;

            const task = {
                taskId: 'task-id',
                dependencies: [dep1, dep2],
                workflow
            } as Task;

            const result1 = { resultId: 'result-1' } as Result;
            const result2 = { resultId: 'result-2' } as Result;

            (mockTaskRepository.findBy as jest.Mock).mockResolvedValue([dep1, dep2]);
            (mockResultRepository.findBy as jest.Mock).mockResolvedValue([result1, result2]);

            // Act
            const results = await taskService.getDependenciesResults(task);

            // Assert
            expect(results).toEqual([result1, result2]);
        });
    });
});