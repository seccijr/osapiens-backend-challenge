import path from 'path';
import { Request, Response } from 'express';

import { WorkflowService } from '../services/WorkflowService';
import { WorkflowFactory, WorkflowStatus } from '../factories/WorkflowFactory';

export class WorkflowController {
    constructor(
        private workflowService: WorkflowService,
        private workflowFactory?: WorkflowFactory
    ) { }

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