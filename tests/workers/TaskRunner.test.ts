import { Repository } from 'typeorm';

import { Job } from '../../src/jobs/Job';

import { Task } from '../../src/models/Task';
import { Workflow } from '../../src/models/Workflow';

import { JobFactory } from '../../src/factories/JobFactory';
import { WorkflowStatus } from '../../src/factories/WorkflowFactory';

import { TaskRunner, TaskStatus } from '../../src/workers/TaskRunner';
import { Result } from '../../src/models/Result';
import { ResultFactory } from '../../src/factories/ResultFactory';

describe('TaskRunner with dependencies', () => {
    const clientId = 'test-client-id';

    let mockJob: Job;
    let taskRunner: TaskRunner;
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
            findOne: jest.fn()
        } as unknown as Repository<Task>;

        mockResultRepository = {
            save: jest.fn().mockImplementation(result => Promise.resolve(result)),
            findOne: jest.fn()
        } as unknown as Repository<Result>;

        mockWorkflowRepository = {
            save: jest.fn().mockImplementation(task => Promise.resolve(task)),
            findOne: jest.fn(),
        } as unknown as Repository<Workflow>;

        taskRunner = new TaskRunner(mockWorkflowRepository, mockResultRepository, mockTaskRepository, mockResultFactory, mockJobFactory);
    });

    describe('run', () => {
        it('should wait for dependent tasks to complete before executing', async () => {
            // Arrange
            const currentWorkflow = {
                workflowId: 'test-workflow-id',
                clientId: clientId,
                status: WorkflowStatus.Initial,
                tasks: []
            } as Workflow;

            const independentTaskResult = {
                resultId: 'result-1',
                data: { someData: 'test data' }
            };

            const independentTask = {
                taskId: 'independent-task',
                status: TaskStatus.Completed,
                output: JSON.stringify({ someData: 'test data' }),
                resultId: 'result-1',
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 1,
                taskType: 'independentTaskType',
                workflow: currentWorkflow
            } as Task;

            const dependentTask = {
                taskId: 'dependent-task',
                dependency: independentTask,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 1,
                taskType: 'dependentTaskType',
                workflow: currentWorkflow
            } as Task;

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(currentWorkflow);
            (mockResultRepository.findOne as jest.Mock)
                .mockImplementation((options) => {
                    const resultId = options.where.resultId;
                    if (resultId === 'result-1') return Promise.resolve(independentTaskResult);
                    return Promise.resolve(null);
                });
            (mockTaskRepository.findOne as jest.Mock).mockResolvedValue(independentTask);

            // Act
            await taskRunner.run(dependentTask);

            // Assert
            expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
                where: { taskId: 'independent-task' }
            });
            expect(mockJob.run).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'dependent-task',
                dependencyResultId: expect.anything()
            }));
        });

        it('should throw an error if dependent task is failed', async () => {
            // Arrange
            const currentWorkflow = {
                workflowId: 'test-workflow-id',
                clientId: clientId,
                status: WorkflowStatus.Initial,
                tasks: []
            } as Workflow;

            const independentTask = {
                taskId: 'independent-task',
                status: TaskStatus.Failed,
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 1,
                taskType: 'independentTaskType',
                workflow: currentWorkflow
            } as Task;

            const dependentTask = {
                taskId: 'dependent-task',
                dependency: independentTask,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 1,
                taskType: 'dependentTaskType',
                workflow: currentWorkflow
            } as Task;

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(currentWorkflow);
            (mockTaskRepository.findOne as jest.Mock).mockResolvedValue(independentTask);

            // Act & Assert
            await expect(taskRunner.run(dependentTask)).rejects.toThrow('Dependent task failed');
        });

        it('should throw an error if dependent task does not exist', async () => {
            // Arrange
            const currentWorkflow = {
                workflowId: 'test-workflow-id',
                clientId: clientId,
                status: WorkflowStatus.Initial,
                tasks: []
            } as Workflow;

            const independentTask = {} as Task;

            const dependentTask = {
                taskId: 'task-id',
                dependency: independentTask,
                status: TaskStatus.Queued,
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 1,
                taskType: 'dependentTaskType',
                workflow: currentWorkflow
            } as Task;

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(currentWorkflow);
            (mockTaskRepository.findOne as jest.Mock).mockResolvedValue(null);

            // Act & Assert
            await expect(taskRunner.run(dependentTask)).rejects.toThrow('Dependent task not found');
        });

        it('should support chained dependencies (A -> B -> C)', async () => {
            // Arrange
            const currentWorkflow = {
                workflowId: 'test-workflow-id',
                clientId: clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const taskAResult = {
                resultId: 'result-a',
                data: { someData: 'test data' }
            };

            const taskA = {
                taskId: 'task-a',
                status: TaskStatus.Completed,
                resultId: 'result-a',
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 1,
                taskType: 'typeA',
                workflow: currentWorkflow
            } as Task;

            const taskBResult = {
                resultId: 'result-b',
                data: { someData: 'test data' }
            };

            const taskB = {
                taskId: 'task-b',
                dependency: taskA,
                status: TaskStatus.Completed,
                resultId: 'result-b',
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 2,
                taskType: 'typeB',
                workflow: currentWorkflow
            } as Task;

            const taskCResult = {
                resultId: 'result-c',
                data: { someData: 'test data' }
            };

            const taskC = {
                taskId: 'task-c',
                dependency: taskB,
                status: TaskStatus.Queued,
                resultId: 'result-c',
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 3,
                taskType: 'typeC',
                workflow: currentWorkflow
            } as Task;

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(currentWorkflow);
            (mockResultRepository.findOne as jest.Mock)
                .mockImplementation((options) => {
                    const resultId = options.where.resultId;
                    if (resultId === 'result-a') return Promise.resolve(taskAResult);
                    if (resultId === 'result-b') return Promise.resolve(taskBResult);
                    if (resultId === 'result-c') return Promise.resolve(taskCResult);
                    return Promise.resolve(null);
                });
            (mockTaskRepository.findOne as jest.Mock)
                .mockImplementation((options) => {
                    const taskId = options.where.taskId;
                    if (taskId === 'task-b') return Promise.resolve(taskB);
                    if (taskId === 'task-a') return Promise.resolve(taskA);
                    return Promise.resolve(null);
                });
            (mockResultFactory.createResult as jest.Mock)
                .mockImplementation((taskId, data) => {
                    if (taskId === 'task-a') return taskAResult;
                    if (taskId === 'task-b') return taskBResult;
                    if (taskId === 'task-c') return taskCResult;
                    return null;
                });

            // Act
            await taskRunner.run(taskB);
            await taskRunner.run(taskC);

            // Assert
            expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
                where: { taskId: 'task-a' }
            });
            expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
                where: { taskId: 'task-b' }
            });
            expect(mockJob.run).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-b',
                dependencyResultId: 'result-a'
            }));
            expect(mockJob.run).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-c',
                dependencyResultId: 'result-b'
            }));
        });



        it('should wait for independent task to complete before executing dependent task', async () => {
            // Arrange
            const currentWorkflow = {
                workflowId: 'test-workflow-id',
                clientId: clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;

            const pendingTask = {
                taskId: 'independent-task',
                status: TaskStatus.InProgress, // Initially in progress
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 1,
                taskType: 'independentTaskType',
                workflow: currentWorkflow
            } as Task;

            const independentTaskResult = {
                resultId: 'independent-task-result',
                data: { someData: 'test data' }
            };

            const completedTask = {
                ...pendingTask,
                status: TaskStatus.Completed,
                resultId: 'independent-task-result'
            };

            const dependentTaskResult = {
                resultId: 'dependent-task-result',
                data: { someData: 'test data' }
            };

            const dependentTask = {
                taskId: 'dependent-task',
                dependency: pendingTask,
                status: TaskStatus.Queued,
                resultId: 'dependent-task-result',
                geoJson: JSON.stringify({}),
                clientId: clientId,
                stepNumber: 2,
                taskType: 'dependentTaskType',
                workflow: currentWorkflow
            } as Task;

            (mockWorkflowRepository.findOne as jest.Mock).mockResolvedValue(currentWorkflow);

            // Mock findOne to first return in-progress task, then completed task
            (mockTaskRepository.findOne as jest.Mock).mockImplementationOnce(() => {
                return Promise.resolve(pendingTask);
            }).mockImplementationOnce(() => {
                return Promise.resolve(completedTask);
            }).mockImplementationOnce(() => {
                return Promise.resolve(completedTask);
            });
            (mockResultRepository.findOne as jest.Mock)
                .mockImplementation((options) => {
                    const resultId = options.where.resultId;
                    if (resultId === 'independent-task-result') return Promise.resolve(independentTaskResult);
                    if (resultId === 'dependent-task-result') return Promise.resolve(dependentTaskResult);
                    return Promise.resolve(null);
                });

            (mockResultFactory.createResult as jest.Mock)
                .mockImplementation((taskId, data) => {
                    if (taskId === 'independent-task') return independentTaskResult;
                    if (taskId === 'dependent-task') return dependentTaskResult;
                    return null;
                });

            // Mock setTimeout to execute immediately for testing
            jest.useFakeTimers();

            // Act
            const runPromise = taskRunner.run(dependentTask);

            // Fast-forward timers
            jest.advanceTimersByTime(1000);

            await runPromise;

            // Assert
            expect(mockTaskRepository.findOne).toHaveBeenCalledTimes(3);
            expect(mockJob.run).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'dependent-task',
                dependencyResultId: 'independent-task-result'
            }));

            jest.useRealTimers();
        });
    });
});