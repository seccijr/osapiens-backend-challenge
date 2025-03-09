import { Repository } from 'typeorm';

import { Job } from '../../src/jobs/Job';
import { Task } from '../../src/models/Task';
import * as JobFactory from '../../src/factories/JobFactory';
import { TaskRunner, TaskStatus } from '../../src/workers/TaskRunner';

jest.mock('../../src/factories/JobFactory');

describe('TaskRunner with dependencies', () => {
    let taskRunner: TaskRunner;
    let mockTaskRepository: Repository<Task>;
    let mockJob: Job;

    beforeEach(() => {
        mockJob = {
            run: jest.fn().mockResolvedValue({ success: true }),
        };

        (JobFactory.getJobForTaskType as jest.Mock).mockReturnValue(mockJob);

        mockTaskRepository = {
            save: jest.fn().mockImplementation(task => Promise.resolve(task)),
            findOne: jest.fn(),
            manager: {
                getRepository: jest.fn().mockReturnValue({
                    save: jest.fn().mockImplementation(result => Promise.resolve({ ...result, resultId: 'test-result-id' }))
                })
            },
        } as unknown as Repository<Task>;

        taskRunner = new TaskRunner(mockTaskRepository);
    });

    describe('run', () => {
        it('should wait for dependent tasks to complete before executing', async () => {
            // Arrange
            const dependentTask = {
                taskId: 'dependent-task',
                status: TaskStatus.Completed,
                output: JSON.stringify({ someData: 'test data' }),
                resultId: 'result-1',
            } as Task;

            const task = {
                taskId: 'task-id',
                dependency: 'dependent-task',
                status: TaskStatus.Queued,
            } as Task;

            (mockTaskRepository.findOne as jest.Mock).mockResolvedValue(dependentTask);

            // Act
            await taskRunner.run(task);

            // Assert
            expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
                where: { taskId: 'dependent-task' }
            });
            expect(mockJob.run).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'task-id',
                dependencyData: expect.anything()
            }));
        });

        it('should throw an error if dependent task is not completed', async () => {
            // Arrange
            const dependentTask = {
                taskId: 'dependent-task',
                status: TaskStatus.InProgress,
            } as Task;

            const task = {
                taskId: 'task-id',
                dependency: 'dependent-task',
                status: TaskStatus.Queued,
            } as Task;

            (mockTaskRepository.findOne as jest.Mock).mockResolvedValue(dependentTask);

            // Act & Assert
            await expect(taskRunner.run(task)).rejects.toThrow('Dependent task is not completed');
        });

        it('should throw an error if dependent task is failed', async () => {
            // Arrange
            const dependentTask = {
                taskId: 'dependent-task',
                status: TaskStatus.Failed,
            } as Task;

            const task = {
                taskId: 'task-id',
                dependency: 'dependent-task',
                status: TaskStatus.Queued,
            } as Task;

            (mockTaskRepository.findOne as jest.Mock).mockResolvedValue(dependentTask);

            // Act & Assert
            await expect(taskRunner.run(task)).rejects.toThrow('Dependent task failed');
        });

        it('should throw an error if dependent task does not exist', async () => {
            // Arrange
            const task = {
                taskId: 'task-id',
                dependency: 'non-existent-task',
                status: TaskStatus.Queued,
            } as Task;

            (mockTaskRepository.findOne as jest.Mock).mockResolvedValue(null);

            // Act & Assert
            await expect(taskRunner.run(task)).rejects.toThrow('Dependent task not found');
        });
    });
});