import { Repository } from 'typeorm';

import { Task } from '../../../src/models/Task';
import { Result } from '../../../src/models/Result';
import { Workflow } from '../../../src/models/Workflow';
import { WorkflowService } from '../../../src/services/WorkflowService';
import { WorkflowStatus } from '../../../src/factories/WorkflowFactory';
import { TaskStatus } from '../../../src/services/TaskService';

describe('WorkflowService', () => {
    const clientId = 'client-id';
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
            mockTaskRepository
        );
    });

    describe('getWorkflowById', () => {
        it('should return a workflow when it exists', async () => {
            // Arrange
            const mockWorkflow = {
                workflowId: 'test-id',
                clientId,
                status: WorkflowStatus.Completed,
                tasks: []
            } as Workflow;
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(mockWorkflow);
            
            // Act
            const result = await service.getWorkflowById('test-id');
            
            // Assert
            expect(result).toBe(mockWorkflow);
            expect(mockWorkflowRepository.findOne).toHaveBeenCalledWith({
                where: { workflowId: 'test-id' },
                relations: ['tasks']
            });
        });

        it('should return null when workflow does not exist', async () => {
            // Arrange
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(null);
            
            // Act
            const result = await service.getWorkflowById('non-existent-id');
            
            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getWorkflowStatusById', () => {
        it('should return status details when workflow exists', async () => {
            // Arrange
            const mockWorkflow = {
                workflowId: 'test-id',
                status: WorkflowStatus.Completed,
                tasks: [
                    { status: TaskStatus.Completed },
                    { status: TaskStatus.Completed },
                    { status: TaskStatus.Failed },
                    { status: TaskStatus.InProgress },
                    { status: TaskStatus.Queued },
                    { status: TaskStatus.Skipped },
                ]
            } as Workflow;
            
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(mockWorkflow);
            
            // Act
            const result = await service.getWorkflowStatusById('test-id');
            
            // Assert
            expect(result).toEqual({
                workflowId: 'test-id',
                status: WorkflowStatus.Completed,
                totalTasks: 6,
                completedTasks: 2,
                failedTasks: 1,
                inProgressTasks: 1,
                queuedTasks: 1,
                skippedTasks: 1
            });
        });

        it('should return null when workflow does not exist', async () => {
            // Arrange
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(null);
            
            // Act
            const result = await service.getWorkflowStatusById('non-existent-id');
            
            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getWorkflowStatus', () => {
        it('should return workflow status when workflow exists', async () => {
            // Arrange
            const mockWorkflow = {
                workflowId: 'test-id',
                clientId: clientId,
                status: WorkflowStatus.InProgress,
                tasks: []
            } as Workflow;
            
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(mockWorkflow);
            
            // Act
            const result = await service.getWorkflowStatus('test-id');
            
            // Assert
            expect(result).toBe(WorkflowStatus.InProgress);
        });

        it('should return null when workflow does not exist', async () => {
            // Arrange
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(null);
            
            // Act
            const result = await service.getWorkflowStatus('non-existent-id');
            
            // Assert
            expect(result).toBeNull();
        });
    });

    describe('getWorkflowTasks', () => {
        it('should return workflow tasks', async () => {
            // Arrange
            const mockTasks = [
                { taskId: '1', taskType: 'Task 1' },
                { taskId: '2', taskType: 'Task 2' }
            ] as Task[];
            
            mockTaskRepository.find = jest.fn().mockResolvedValue(mockTasks);
            
            // Act
            const result = await service.getWorkflowTasks('test-id');
            
            // Assert
            expect(result).toBe(mockTasks);
            expect(mockTaskRepository.find).toHaveBeenCalledWith({
                where: { workflow: { workflowId: 'test-id' } }
            });
        });
    });

    describe('getWorkflowResults', () => {
        it('should return parsed JSON results when workflow exists and has finalResult', async () => {
            // Arrange
            const jsonResult = { output: 'test data', success: true };
            const mockWorkflow = {
                workflowId: 'test-id',
                clientId: clientId,
                status: WorkflowStatus.Completed,
                finalResult: JSON.stringify(jsonResult),
                tasks: []
            } as Workflow;
            
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(mockWorkflow);
            
            // Act
            const result = await service.getWorkflowResults('test-id');
            
            // Assert
            expect(result).toEqual(jsonResult);
        });

        it('should return raw string when finalResult is not valid JSON', async () => {
            // Arrange
            const rawResult = 'This is not JSON';
            const mockWorkflow = {
                workflowId: 'test-id',
                clientId: clientId,
                status: WorkflowStatus.Completed,
                finalResult: rawResult,
                tasks: []
            } as Workflow;
            
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(mockWorkflow);
            
            // Act
            const result = await service.getWorkflowResults('test-id');
            
            // Assert
            expect(result).toBe(rawResult);
        });

        it('should return null when workflow does not exist', async () => {
            // Arrange
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(null);
            
            // Act
            const result = await service.getWorkflowResults('non-existent-id');
            
            // Assert
            expect(result).toBeNull();
        });

        it('should return null when workflow exists but has no finalResult', async () => {
            // Arrange
            const mockWorkflow = {
                workflowId: 'test-id',
                clientId: clientId,
                status: WorkflowStatus.Completed,
                finalResult: undefined,
                tasks: []
            } as Workflow;
            
            mockWorkflowRepository.findOne = jest.fn().mockResolvedValue(mockWorkflow);
            
            // Act
            const result = await service.getWorkflowResults('test-id');
            
            // Assert
            expect(result).toBeNull();
        });
    });
});