import { DataSource, EntityTarget, Repository } from 'typeorm';

import { Task } from '../../src/models/Task';
import { Result } from '../../src/models/Result';
import { TaskStatus } from '../../src/workers/TaskRunner';
import { ReportGenerationJob } from '../../src/jobs/ReportGenerationJob'

describe('ReportGenerationJob', () => {
    let job: ReportGenerationJob;
    let mockTask: Task;
    let mockResultRepository: Repository<Result>;
    let mockTaskRepository: Repository<Task>;
    let mockDataSource: DataSource;

    beforeEach(() => {
        mockResultRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
        } as unknown as Repository<Result>;

        mockTaskRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
        } as unknown as Repository<Task>;

        mockDataSource = {
            getRepository: jest.fn().mockImplementation((entity: EntityTarget<any>) => {
                if (entity === Result) {
                    return mockResultRepository;
                }
                if (entity === Task) {
                    return mockTaskRepository;
                }
                throw new Error(`Repository not mocked for entity: ${entity}`);
            })
        } as unknown as DataSource;


        job = new ReportGenerationJob(mockDataSource);

        mockTask = {
            taskId: 'report-task-id',
            workflow: {
                workflowId: 'test-workflow-id',
            },
            taskType: 'report_generation',
            status: TaskStatus.InProgress,
            geoJson: JSON.stringify({}),
            progress: '',
        } as Task;
    });

    describe('run', () => {
        it('should aggregate outputs from all preceding tasks', async () => {
            // Arrange
            const mockTasks = [
                {
                    taskId: 'task-1',
                    workflow: {
                        workflowId: 'test-workflow-id',
                    },
                    taskType: 'polygonArea',
                    status: TaskStatus.Completed,
                    resultId: 'result-1',
                },
                {
                    taskId: 'task-2',
                    workflow: {
                        workflowId: 'test-workflow-id',
                    },
                    taskType: 'dataAnalysis',
                    status: TaskStatus.Completed,
                    resultId: 'result-2',
                },
            ] as Task[];

            const mockResults = [
                {
                    resultId: 'result-1',
                    taskId: 'task-1',
                    data: JSON.stringify({ area: 100, unit: 'square meters' }),
                },
                {
                    resultId: 'result-2',
                    taskId: 'task-2',
                    data: JSON.stringify({ analysisResult: 'Some analysis data' }),
                },
            ] as Result[];

            (mockTaskRepository.find as jest.Mock).mockResolvedValue(mockTasks);
            (mockResultRepository.findOne as jest.Mock).mockImplementation(async (options: any) => {
                const taskId = options.where.taskId;
                return mockResults.find(r => r.taskId === taskId);
            });

            // Act
            const result = await job.run(mockTask);

            // Assert
            expect(result).toBeDefined();
            expect(result.workflow.workflowId).toBe('test-workflow-id');
            expect(result.tasks).toHaveLength(2);
            expect(result.tasks[0].taskId).toBe('task-1');
            expect(result.tasks[0].type).toBe('polygonArea');
            expect(result.tasks[1].taskId).toBe('task-2');
            expect(result.tasks[1].type).toBe('dataAnalysis');
            expect(result.finalReport).toBeDefined();
        });

        it('should handle failed tasks in the report', async () => {
            // Arrange
            const mockTasks = [
                {
                    taskId: 'task-1',
                    workflow: {
                        workflowId: 'test-workflow-id',
                    },
                    taskType: 'polygonArea',
                    status: TaskStatus.Completed,
                    resultId: 'result-1',
                },
                {
                    taskId: 'task-2',
                    workflow: {
                        workflowId: 'test-workflow-id',
                    },
                    taskType: 'dataAnalysis',
                    status: TaskStatus.Failed,
                    progress: 'Failed due to invalid input',
                },
            ] as Task[];

            const mockResults = [
                {
                    resultId: 'result-1',
                    taskId: 'task-1',
                    data: JSON.stringify({ area: 100, unit: 'square meters' }),
                },
            ] as Result[];

            (mockTaskRepository.find as jest.Mock).mockResolvedValue(mockTasks);
            (mockResultRepository.findOne as jest.Mock).mockImplementation(async (options: any) => {
                const taskId = options.where.taskId;
                return mockResults.find(r => r.taskId === taskId);
            });

            // Act
            const result = await job.run(mockTask);

            // Assert
            expect(result).toBeDefined();
            expect(result.tasks).toHaveLength(2);
            expect(result.tasks[0].taskId).toBe('task-1');
            expect(result.tasks[0].status).toBe('completed');
            expect(result.tasks[1].taskId).toBe('task-2');
            expect(result.tasks[1].status).toBe('failed');
            expect(result.tasks[1].error).toBe('Failed due to invalid input');
            expect(result.summary.completedTasks).toBe(1);
            expect(result.summary.failedTasks).toBe(1);
        });

        it('should handle empty workflows', async () => {
            // Arrange
            (mockTaskRepository.find as jest.Mock).mockResolvedValue([]);

            // Act
            const result = await job.run(mockTask);

            // Assert
            expect(result).toBeDefined();
            expect(result.tasks).toHaveLength(0);
            expect(result.summary.totalTasks).toBe(0);
            expect(result.finalReport).toBe('No tasks found in workflow');
        });

        it('should throw an error if workflow ID is missing', async () => {
            // Arrange
            mockTask.workflow.workflowId = '';

            // Act & Assert
            await expect(job.run(mockTask)).rejects.toThrow('WorkflowId is required');
        });
    });
});