import { Repository } from 'typeorm';

import { Task } from '../../../src/models/Task';
import { Result } from '../../../src/models/Result';
import { Workflow } from '../../../src/models/Workflow';
import { TaskStatus } from '../../../src/workers/TaskRunner';
import { WorkflowService } from '../../../src/services/WorkflowService';

describe('WorkflowService', () => {
    let service: WorkflowService;
    let mockWorkflowRepository: Repository<Workflow>;
    let mockTaskRepository: Repository<Task>;
    let mockResultRepository: Repository<Result>;

    beforeEach(() => {
        mockWorkflowRepository = {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation(workflow => Promise.resolve(workflow)),
        } as unknown as Repository<Workflow>;

        mockTaskRepository = {
            find: jest.fn(),
        } as unknown as Repository<Task>;

        mockResultRepository = {
            findOne: jest.fn(),
        } as unknown as Repository<Result>;

        service = new WorkflowService(
            mockWorkflowRepository,
            mockTaskRepository,
            mockResultRepository
        );
    });

    describe('updateWorkflowFinalResult', () => {
        it('should aggregate outputs from all tasks and save to workflow finalResult', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
            } as Workflow;

            const tasks = [
                {
                    taskId: 'task-1',
                    workflow: workflow,
                    taskType: 'polygonArea',
                    status: TaskStatus.Completed,
                    resultId: 'result-1',
                },
                {
                    taskId: 'task-2',
                    workflow: workflow,
                    taskType: 'dataAnalysis',
                    status: TaskStatus.Completed,
                    resultId: 'result-2',
                },
            ] as Task[];

            const results = [
                {
                    resultId: 'result-1',
                    taskId: 'task-1',
                    data: JSON.stringify({ area: 100 }),
                },
                {
                    resultId: 'result-2',
                    taskId: 'task-2',
                    data: JSON.stringify({ analysisResult: 'Some data' }),
                },
            ] as Result[];

            (mockTaskRepository.find as jest.Mock).mockResolvedValue(tasks);
            (mockResultRepository.findOne as jest.Mock).mockImplementation(async (options: any) => {
                const taskId = options.where.taskId;
                return results.find(r => r.taskId === taskId);
            });

            // Act
            await service.updateWorkflowFinalResult(workflow);

            // Assert
            expect(mockWorkflowRepository.save).toHaveBeenCalledWith(expect.objectContaining({
                workflowId: 'test-workflow',
                finalResult: expect.any(String)
            }));

            const savedWorkflow = (mockWorkflowRepository.save as jest.Mock).mock.calls[0][0];
            const finalResult = JSON.parse(savedWorkflow.finalResult);

            expect(finalResult.tasks).toHaveLength(2);
            expect(finalResult.tasks[0].taskId).toBe('task-1');
            expect(finalResult.tasks[1].taskId).toBe('task-2');
            expect(finalResult.summary).toBeDefined();
        });

        it('should include failed task information in the final result', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
            } as Workflow;

            const tasks = [
                {
                    taskId: 'task-1',
                    workflow: workflow,
                    taskType: 'polygonArea',
                    status: TaskStatus.Completed,
                    resultId: 'result-1',
                },
                {
                    taskId: 'task-2',
                    workflow: workflow,
                    taskType: 'dataAnalysis',
                    status: TaskStatus.Failed,
                    progress: 'Error: Invalid input',
                },
            ] as Task[];

            const results = [
                {
                    resultId: 'result-1',
                    taskId: 'task-1',
                    data: JSON.stringify({ area: 100 }),
                },
            ] as Result[];

            (mockTaskRepository.find as jest.Mock).mockResolvedValue(tasks);
            (mockResultRepository.findOne as jest.Mock).mockImplementation(async (options: any) => {
                const taskId = options.where.taskId;
                return results.find(r => r.taskId === taskId);
            });

            // Act
            await service.updateWorkflowFinalResult(workflow);

            // Assert
            expect(mockWorkflowRepository.save).toHaveBeenCalled();

            const savedWorkflow = (mockWorkflowRepository.save as jest.Mock).mock.calls[0][0];
            const finalResult = JSON.parse(savedWorkflow.finalResult);

            expect(finalResult.tasks).toHaveLength(2);
            expect(finalResult.tasks[0].status).toBe('completed');
            expect(finalResult.tasks[1].status).toBe('failed');
            expect(finalResult.tasks[1].error).toBe('Error: Invalid input');
            expect(finalResult.success).toBe(false);
        });

        it('should mark workflow as successful when all tasks are completed', async () => {
            // Arrange
            const workflow = {
                workflowId: 'test-workflow',
            } as Workflow;

            const tasks = [
                {
                    taskId: 'task-1',
                    workflow: workflow,
                    taskType: 'polygonArea',
                    status: TaskStatus.Completed,
                    resultId: 'result-1',
                },
                {
                    taskId: 'task-2',
                    workflow: workflow,
                    taskType: 'dataAnalysis',
                    status: TaskStatus.Completed,
                    resultId: 'result-2',
                },
            ] as Task[];

            const results = [
                {
                    resultId: 'result-1',
                    taskId: 'task-1',
                    data: JSON.stringify({ area: 100 }),
                },
                {
                    resultId: 'result-2',
                    taskId: 'task-2',
                    data: JSON.stringify({ analysisResult: 'Some data' }),
                },
            ] as Result[];

            (mockTaskRepository.find as jest.Mock).mockResolvedValue(tasks);
            (mockResultRepository.findOne as jest.Mock).mockImplementation(async (options: any) => {
                const taskId = options.where.taskId;
                return results.find(r => r.taskId === taskId);
            });

            // Act
            await service.updateWorkflowFinalResult(workflow);

            // Assert
            const savedWorkflow = (mockWorkflowRepository.save as jest.Mock).mock.calls[0][0];
            const finalResult = JSON.parse(savedWorkflow.finalResult);

            expect(finalResult.success).toBe(true);
            expect(finalResult.summary.completedTasks).toBe(2);
            expect(finalResult.summary.failedTasks).toBe(0);
        });
    });
});