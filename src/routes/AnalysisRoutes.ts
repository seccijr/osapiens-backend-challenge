import { Router } from 'express';

import { WorkflowController } from '../controllers/WorkflowController';

export const createAnalysisRouter = (workflowController: WorkflowController) => {
    const router = Router();

    router.post('/', async (req, res) => {
        await workflowController.createAnalysisWorkflow(req, res);
    });

    return router;
}