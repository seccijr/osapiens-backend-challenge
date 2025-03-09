import { Router } from 'express';
import { WorkflowController } from '../controllers/WorkflowController';

export const createWorkflowRouter = (workflowController: WorkflowController) => {
    const router = Router();

    router.get('/:id/results', async (req, res) => {
        return workflowController.getWorkflowResults(req, res);
    });

    router.get('/:id/status', async (req, res) => {
        return workflowController.getWorkflowStatus(req, res);
    });

    return router;
}