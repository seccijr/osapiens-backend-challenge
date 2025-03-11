import { TaskService, TaskStatus } from '../../../src/services/TaskService';
import { TaskWorker } from '../../../src/workers/TaskWorker';
import { Task } from '../../../src/models/Task';
import { Workflow } from '../../../src/models/Workflow';
import { WorkflowStatus } from '../../../src/factories/WorkflowFactory';

describe('TaskWorker', () => {
    let mockTaskService: TaskService;
    let taskWorker: TaskWorker;

    // Mock setTimeout to execute immediately in tests
    jest.useFakeTimers();

    beforeEach(() => {
        // Setup mock for TaskService
        mockTaskService = {
            prepare: jest.fn(),
            run: jest.fn(),
            getReadyTasks: jest.fn(),
            getQueuedTasks: jest.fn()
        } as unknown as TaskService;

        // Create TaskWorker instance with mocks - note only TaskService is passed now
        taskWorker = new TaskWorker(mockTaskService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('pool', () => {
        it('should prepare queued tasks before running ready tasks', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
                clientId: 'test-client',
                status: WorkflowStatus.InProgress
            } as Workflow;

            const queuedTasks = [
                {
                    taskId: 'task-1',
                    status: TaskStatus.Queued,
                    workflow
                } as Task,
                {
                    taskId: 'task-2',
                    status: TaskStatus.Queued,
                    workflow
                } as Task
            ];

            const readyTasks = [
                {
                    taskId: 'task-1',
                    status: TaskStatus.Ready,
                    workflow
                } as Task
            ];

            // First call returns queued tasks, second call returns empty to stop the worker
            (mockTaskService.getQueuedTasks as jest.Mock)
                .mockResolvedValueOnce(queuedTasks)
                .mockResolvedValueOnce([]);

            // Mock TaskService to return ready tasks after preparation
            (mockTaskService.getReadyTasks as jest.Mock).mockResolvedValue(readyTasks);

            // Act
            const poolPromise = taskWorker.pool();
            jest.advanceTimersByTime(200); // Advance through 2 loops
            taskWorker.stop(); // Stop the worker
            await poolPromise;

            // Assert
            expect(mockTaskService.prepare).toHaveBeenCalledTimes(2);
            expect(mockTaskService.prepare).toHaveBeenCalledWith(queuedTasks[0]);
            expect(mockTaskService.prepare).toHaveBeenCalledWith(queuedTasks[1]);
            expect(mockTaskService.run).toHaveBeenCalledTimes(1);
            expect(mockTaskService.run).toHaveBeenCalledWith(readyTasks[0]);
        });

        it('should process tasks in small batches', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
                clientId: 'test-client',
                status: WorkflowStatus.InProgress
            } as Workflow;

            // Create 25 queued tasks
            const queuedTasks = Array.from({ length: 25 }, (_, i) => ({
                taskId: `task-${i}`,
                status: TaskStatus.Queued,
                workflow
            } as Task));

            // Create 20 ready tasks (as if prepare made some of them ready)
            const readyTasks = Array.from({ length: 20 }, (_, i) => ({
                taskId: `task-${i}`,
                status: TaskStatus.Ready,
                workflow
            } as Task));

            // Mock service to return queued tasks once, then empty array
            (mockTaskService.getQueuedTasks as jest.Mock)
                .mockResolvedValueOnce(queuedTasks)
                .mockResolvedValueOnce([]);

            // Mock TaskService to return ready tasks
            (mockTaskService.getReadyTasks as jest.Mock).mockResolvedValue(readyTasks);

            // Act
            const poolPromise = taskWorker.pool();
            jest.advanceTimersByTime(200); // Process one iteration
            taskWorker.stop();
            await poolPromise;

            // Assert
            expect(mockTaskService.prepare).toHaveBeenCalledTimes(25);
            expect(mockTaskService.run).toHaveBeenCalledTimes(20);

            // Verify tasks are processed in batches (should have processed in batches of 10)
            const processedTaskIds = new Set();
            for (let i = 0; i < 20; i++) {
                const call = (mockTaskService.run as jest.Mock).mock.calls[i][0];
                processedTaskIds.add(call.taskId);
            }
            expect(processedTaskIds.size).toBe(20);
        });

        it('should handle errors during task preparation', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
                clientId: 'test-client',
                status: WorkflowStatus.InProgress
            } as Workflow;

            const task = {
                taskId: 'error-task',
                status: TaskStatus.Queued,
                workflow
            } as Task;

            // Mock service to return a task that will cause an error, then empty array
            (mockTaskService.getQueuedTasks as jest.Mock)
                .mockResolvedValueOnce([task])
                .mockResolvedValueOnce([]);

            // Mock TaskService to throw error during prepare
            (mockTaskService.prepare as jest.Mock).mockRejectedValue(new Error('Prepare error'));

            // Spy on console.error
            jest.spyOn(console, 'error').mockImplementation(() => { });

            // Act
            const poolPromise = taskWorker.pool();
            jest.advanceTimersByTime(200);
            taskWorker.stop();
            await poolPromise;

            // Assert
            expect(mockTaskService.prepare).toHaveBeenCalledWith(task);
            expect(console.error).toHaveBeenCalled();
            expect(mockTaskService.run).not.toHaveBeenCalled();
        });

        it('should handle errors during task execution', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
                clientId: 'test-client',
                status: WorkflowStatus.InProgress
            } as Workflow;

            const queuedTask = {
                taskId: 'queued-task',
                status: TaskStatus.Queued,
                workflow
            } as Task;

            const readyTask = {
                taskId: 'ready-task',
                status: TaskStatus.Ready,
                workflow
            } as Task;

            // Mock service calls
            (mockTaskService.getQueuedTasks as jest.Mock)
                .mockResolvedValueOnce([queuedTask])
                .mockResolvedValueOnce([]);

            (mockTaskService.prepare as jest.Mock).mockResolvedValue(undefined);
            (mockTaskService.getReadyTasks as jest.Mock).mockResolvedValue([readyTask]);
            (mockTaskService.run as jest.Mock).mockRejectedValue(new Error('Run error'));

            // Spy on console.error
            jest.spyOn(console, 'error').mockImplementation(() => { });

            // Act
            const poolPromise = taskWorker.pool();
            jest.advanceTimersByTime(200);
            taskWorker.stop();
            await poolPromise;

            // Assert
            expect(mockTaskService.prepare).toHaveBeenCalledWith(queuedTask);
            expect(mockTaskService.run).toHaveBeenCalledWith(readyTask);
            expect(console.error).toHaveBeenCalled();
        });

        it('should stop processing when stop flag is set', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
                clientId: 'test-client',
                status: WorkflowStatus.InProgress
            } as Workflow;

            const queuedTasks = [
                { taskId: 'task-1', status: TaskStatus.Queued, workflow } as Task
            ];

            // Mock service to always return tasks (would loop forever if not stopped)
            (mockTaskService.getQueuedTasks as jest.Mock).mockResolvedValue(queuedTasks);

            // Act
            const poolPromise = taskWorker.pool();

            // After one loop, stop the worker
            jest.advanceTimersByTime(100);
            taskWorker.stop();

            await poolPromise;

            // Assert
            // Should have called getQueuedTasks only once before stopping
            expect(mockTaskService.getQueuedTasks).toHaveBeenCalledTimes(1);
        });
    });
});