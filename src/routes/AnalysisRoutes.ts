import path from 'path';
import dotenv from 'dotenv';
import { Router } from 'express';

import { WorkflowFactory } from '../factories/WorkflowFactory';

dotenv.config();

export const createAnalysisRouter = (workflowFactory: WorkflowFactory) => {
    const router = Router();

    router.post('/', async (req, res) => {
        if (!process.env.WORKFLOW_DIR) {
            throw new Error('WORKFLOW_DIR environment variable is not set.');
        }
        const { clientId, geoJson } = req.body;
        const workflowFile = path.join(process.env.WORKFLOW_DIR, 'analysis.yml');

        try {
            const workflow = await workflowFactory.createWorkflowFromYAML(workflowFile, clientId, JSON.stringify(geoJson));

            res.status(202).json({
                workflowId: workflow.workflowId,
                message: 'Workflow created and tasks queued from YAML definition.'
            });
        } catch (error: any) {
            console.error('Error creating workflow:', error);
            res.status(500).json({ message: 'Failed to create workflow' });
        }
    });

    return router;
}