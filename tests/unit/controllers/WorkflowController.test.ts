import { Request, Response } from 'express';

import { Workflow } from '../../../src/models/Workflow';
import { WorkflowService } from '../../../src/services/WorkflowService';
import { WorkflowController } from '../../../src/controllers/WorkflowController';
import { WorkflowStatus } from '../../../src/factories/WorkflowFactory';

describe('WorkflowController', () => {
    let controller: WorkflowController;
    let mockWorkflowService: WorkflowService;
    let mockRequest: Request;
    let mockResponse: Response;

    beforeEach(() => {
        mockWorkflowService = {
            getWorkflowById: jest.fn(),
            getWorkflowStatus: jest.fn(),
            getWorkflowTasks: jest.fn(),
            getWorkflowResults: jest.fn(),
            updateWorkflowFinalResult: jest.fn(),
        } as unknown as WorkflowService;

        mockRequest = {
            params: {
                id: 'test-workflow-id'
            }
        } as unknown as Request;

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        } as unknown as Response;

        controller = new WorkflowController(mockWorkflowService);
    });

    describe('getWorkflowResults', () => {
        it('should return workflow results when workflow is completed', async () => {
            // Arrange
            const completedWorkflow = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.Completed,
                finalResult: 'Sample workflow result data'
            } as Workflow;

            (mockWorkflowService.getWorkflowById as jest.Mock).mockResolvedValue(completedWorkflow);

            // Act
            await controller.getWorkflowResults(mockRequest, mockResponse);

            // Assert
            expect(mockWorkflowService.getWorkflowById).toHaveBeenCalledWith('test-workflow-id');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                workflowId: 'test-workflow-id',
                status: 'completed',
                finalResult: 'Sample workflow result data'
            });
        });

        it('should return 404 when workflow is not found', async () => {
            // Arrange
            (mockWorkflowService.getWorkflowById as jest.Mock).mockResolvedValue(null);

            // Act
            await controller.getWorkflowResults(mockRequest, mockResponse);

            // Assert
            expect(mockWorkflowService.getWorkflowById).toHaveBeenCalledWith('test-workflow-id');
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Workflow not found'
            });
        });

        it('should return 400 when workflow is not completed', async () => {
            // Arrange
            const pendingWorkflow = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.Initial,
            } as Workflow;

            (mockWorkflowService.getWorkflowById as jest.Mock).mockResolvedValue(pendingWorkflow);

            // Act
            await controller.getWorkflowResults(mockRequest, mockResponse);

            // Assert
            expect(mockWorkflowService.getWorkflowById).toHaveBeenCalledWith('test-workflow-id');
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Workflow is not yet completed'
            });
        });

        it('should return 400 when workflow is in progress', async () => {
            // Arrange
            const inProgressWorkflow = {
                workflowId: 'test-workflow-id',
                status: 'in_progress',
            } as Workflow;

            (mockWorkflowService.getWorkflowById as jest.Mock).mockResolvedValue(inProgressWorkflow);

            // Act
            await controller.getWorkflowResults(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Workflow is not yet completed'
            });
        });

        it('should return 400 when workflow is failed', async () => {
            // Arrange
            const failedWorkflow = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.Failed,
                finalResult: 'Some error occurred'
            } as Workflow;

            (mockWorkflowService.getWorkflowById as jest.Mock).mockResolvedValue(failedWorkflow);

            // Act
            await controller.getWorkflowResults(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Workflow failed: Some error occurred'
            });
        });

        it('should handle empty results for completed workflows', async () => {
            // Arrange
            const completedWorkflowEmptyResults = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.Completed,
                finalResult: ''
            } as Workflow;

            (mockWorkflowService.getWorkflowById as jest.Mock).mockResolvedValue(completedWorkflowEmptyResults);

            // Act
            await controller.getWorkflowResults(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                workflowId: 'test-workflow-id',
                status: 'completed',
                finalResult: ''
            });
        });

        it('should handle service exceptions', async () => {
            // Arrange
            const errorMessage = 'Database connection error';
            (mockWorkflowService.getWorkflowById as jest.Mock).mockRejectedValue(new Error(errorMessage));

            // Act
            await controller.getWorkflowResults(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Internal server error: ' + errorMessage
            });
        });
    });
});