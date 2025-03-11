import path from 'path';
import { Request, Response } from 'express';

import { WorkflowService } from '../services/WorkflowService';
import { WorkflowFactory, WorkflowStatus } from '../factories/WorkflowFactory';

/**
 * Controller responsible for handling workflow-related HTTP requests.
 */
export class WorkflowController {
    /**
     * Creates an instance of WorkflowController.
     * 
     * @param workflowService Service for workflow operations
     * @param workflowFactory Optional factory for creating workflows from definitions
     */
    constructor(
        private workflowService: WorkflowService,
        private workflowFactory?: WorkflowFactory
    ) { }

    /**
     * Retrieves the current status of a workflow by its ID.
     * 
     * @param req Express request object containing the workflow ID in params
     * @param res Express response object
     * @returns Promise<void>
     */
    async getWorkflowStatus(req: Request, res: Response): Promise<void> {
        try {
            const workflowId = req.params.id;
            const workflow = await this.workflowService.getWorkflowById(workflowId);

            if (!workflow) {
                res.status(404).json({
                    error: 'Workflow not found'
                });
                return;
            }

            res.status(200).json({
                workflowId: workflow.workflowId,
                status: workflow.status
            });
        } catch (error: any) {
            res.status(500).json({
                error: `Internal server error: ${error.message}`
            });
        }
    }

    /**
     * Retrieves the final results of a completed workflow.
     * Updates and fetches the latest workflow data before returning it.
     * Returns error if the workflow doesn't exist, has failed, or hasn't completed yet.
     * 
     * @param req Express request object containing the workflow ID in params
     * @param res Express response object
     * @returns Promise<void>
     */
    async getWorkflowResults(req: Request, res: Response): Promise<void> {
        try {
            const workflowId = req.params.id;
            let workflow = await this.workflowService.getWorkflowById(workflowId);

            if (!workflow) {
                res.status(404).json({
                    error: 'Workflow not found'
                });
                return;
            }

            await this.workflowService.updateWorkflowFinalResult(workflow);
            workflow = await this.workflowService.getWorkflowById(workflowId);
            if (!workflow) {
                res.status(404).json({
                    error: 'Workflow not found'
                });
                return;
            }

            if (workflow.status === WorkflowStatus.Failed) {
                res.status(400).json({
                    error: `Workflow failed: ${workflow.finalResult || 'Unknown error'}`
                });
                return;
            }

            if (workflow.status !== WorkflowStatus.Completed) {
                res.status(400).json({
                    error: 'Workflow is not yet completed'
                });
                return;
            }

            res.status(200).json({
                workflowId: workflow.workflowId,
                status: workflow.status,
                finalResult: workflow.finalResult
            });
        } catch (error: any) {
            res.status(500).json({
                error: `Internal server error: ${error.message}`
            });
        }
    }

    /**
     * Creates a new geospatial analysis workflow based on a predefined YAML definition.
     * Requires clientId and geoJson in the request body.
     * Uses the WORKFLOW_DIR environment variable to locate the workflow definition.
     * 
     * @param req Express request object containing clientId and geoJson in the body
     * @param res Express response object
     * @returns Promise<void>
     */
    async createAnalysisWorkflow(req: Request, res: Response): Promise<void> {
        try {
            if (!process.env.WORKFLOW_DIR) {
                res.status(500).json({
                    error: 'WORKFLOW_DIR environment variable is not set.'
                });
                return;
            }

            const { clientId, geoJson } = req.body;

            if (!clientId) {
                res.status(400).json({
                    error: 'Missing required field: clientId'
                });
                return;
            }

            if (!geoJson) {
                res.status(400).json({
                    error: 'Missing required field: geoJson'
                });
                return;
            }

            const workflowFile = path.join(process.env.WORKFLOW_DIR, 'analysis.yml');

            if (!this.workflowFactory) {
                throw new Error('WorkflowFactory not initialized');
            }

            const workflow = await this.workflowFactory.createWorkflowFromYAML(
                workflowFile,
                clientId,
                JSON.stringify(geoJson)
            );

            res.status(202).json({
                workflowId: workflow.workflowId,
                message: 'Workflow created and tasks queued from YAML definition.'
            });
        } catch (error: any) {
            console.error('Error creating analysis workflow:', error);
            res.status(500).json({
                error: `Internal server error: ${error.message}`
            });
        }
    }
}