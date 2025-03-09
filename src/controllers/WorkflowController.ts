import { Request, Response } from 'express';
import { WorkflowService } from '../services/WorkflowService';
import { WorkflowStatus } from '../factories/WorkflowFactory';

export class WorkflowController {
    constructor(private workflowService: WorkflowService) { }

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
            const workflow = await this.workflowService.getWorkflowById(workflowId);

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
}