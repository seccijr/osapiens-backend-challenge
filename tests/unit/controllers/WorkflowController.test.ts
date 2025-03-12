import { Request, Response } from 'express';

import { Workflow } from '../../../src/models/Workflow';
import { WorkflowService } from '../../../src/services/WorkflowService';
import { WorkflowController } from '../../../src/controllers/WorkflowController';
import { WorkflowFactory, WorkflowStatus } from '../../../src/factories/WorkflowFactory';

describe('WorkflowController', () => {
    let controller: WorkflowController;
    let mockWorkflowService: WorkflowService;
    let mockRequest: Request;
    let mockResponse: Response;
    let mockWorkflowFactory: WorkflowFactory;

    beforeEach(() => {
        mockWorkflowService = {
            getWorkflowById: jest.fn(),
            getWorkflowTasks: jest.fn(),
            getWorkflowResults: jest.fn(),
        } as unknown as WorkflowService;

        mockWorkflowFactory = {
            createWorkflowFromYAML: jest.fn()
        } as unknown as WorkflowFactory;

        mockRequest = {
            params: {
                id: 'test-workflow-id'
            },
            body: {}
        } as unknown as Request;

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        } as unknown as Response;

        controller = new WorkflowController(mockWorkflowService, mockWorkflowFactory);
    });

    describe('getWorkflowResults', () => {
        it('should return workflow results when workflow is completed', async () => {
            // Arrange
            const completedWorkflow = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.Completed,
                finalResult: '["Sample workflow result data"]'
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
                finalResult: ["Sample workflow result data"]
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

    describe('createAnalysisWorkflow', () => {
        beforeEach(() => {
            process.env.WORKFLOW_DIR = '/test/workflows';
            mockRequest.body = {
                clientId: 'test-client',
                geoJson: { type: 'FeatureCollection', features: [] }
            };
        });

        afterEach(() => {
            delete process.env.WORKFLOW_DIR;
        });

        it('should create and return a new analysis workflow', async () => {
            // Arrange
            const expectedWorkflow = {
                workflowId: 'new-workflow-id'
            };

            (mockWorkflowFactory.createWorkflowFromYAML as jest.Mock).mockResolvedValue(expectedWorkflow);

            // Act
            await controller.createAnalysisWorkflow(mockRequest, mockResponse);

            // Assert
            expect(mockWorkflowFactory.createWorkflowFromYAML).toHaveBeenCalledWith(
                expect.anything(),
                'test-client',
                JSON.stringify({ type: 'FeatureCollection', features: [] })
            );
            expect(mockResponse.status).toHaveBeenCalledWith(202);
            expect(mockResponse.json).toHaveBeenCalledWith({
                workflowId: 'new-workflow-id',
                message: 'Workflow created and tasks queued from YAML definition.'
            });
        });

        it('should return 400 when clientId is missing', async () => {
            // Arrange
            mockRequest.body = {
                geoJson: { type: 'FeatureCollection', features: [] }
            };

            // Act
            await controller.createAnalysisWorkflow(mockRequest, mockResponse);

            // Assert
            expect(mockWorkflowFactory.createWorkflowFromYAML).not.toHaveBeenCalled();
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Missing required field: clientId'
            });
        });

        it('should return 400 when geoJson is missing', async () => {
            // Arrange
            mockRequest.body = {
                clientId: 'test-client'
            };

            // Act
            await controller.createAnalysisWorkflow(mockRequest, mockResponse);

            // Assert
            expect(mockWorkflowFactory.createWorkflowFromYAML).not.toHaveBeenCalled();
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Missing required field: geoJson'
            });
        });

        it('should return 500 when WORKFLOW_DIR environment variable is not set', async () => {
            // Arrange
            delete process.env.WORKFLOW_DIR;

            // Act
            await controller.createAnalysisWorkflow(mockRequest, mockResponse);

            // Assert
            expect(mockWorkflowFactory.createWorkflowFromYAML).not.toHaveBeenCalled();
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'WORKFLOW_DIR environment variable is not set.'
            });
        });

        it('should handle factory exceptions', async () => {
            // Arrange
            const errorMessage = 'Failed to create workflow from YAML';
            (mockWorkflowFactory.createWorkflowFromYAML as jest.Mock).mockRejectedValue(new Error(errorMessage));
            jest.spyOn(console, 'error').mockImplementation(() => { });

            // Act
            await controller.createAnalysisWorkflow(mockRequest, mockResponse);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                error: 'Internal server error: ' + errorMessage
            });
        });
    });
});