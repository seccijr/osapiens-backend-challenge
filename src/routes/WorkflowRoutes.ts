import { Router } from 'express';
import { WorkflowController } from '../controllers/WorkflowController';

export const createWorkflowRouter = (workflowController: WorkflowController) => {
    const router = Router();

    /**
     * Retrieves the results of a specific workflow
     * 
     * @route GET /:id/results
     * @param {string} req.params.id - The unique identifier of the workflow
     * 
     * @swagger
     * /workflow/{id}/results:
     *   get:
     *     summary: Get workflow results
     *     description: Retrieve the final results of a completed workflow
     *     tags: [Workflows]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workflow ID
     *     responses:
     *       200:
     *         description: Workflow results retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 workflowId:
     *                   type: string
     *                   description: The ID of the workflow
     *                 status:
     *                   type: string
     *                   description: Current status of the workflow
     *                   enum: [Completed]
     *                 finalResult:
     *                   type: string
     *                   description: The final result data of the workflow
     *       400:
     *         description: Workflow not completed or failed
     *       404:
     *         description: Workflow not found
     *       500:
     *         description: Internal server error
     */
    router.get('/:id/results', async (req, res) => {
        return workflowController.getWorkflowResults(req, res);
    });

    /**
     * Retrieves the current status of a specific workflow
     * 
     * @route GET /:id/status
     * @param {string} req.params.id - The unique identifier of the workflow
     * 
     * @swagger
     * /workflow/{id}/status:
     *   get:
     *     summary: Get workflow status
     *     description: Retrieve the current status of a workflow by its ID
     *     tags: [Workflows]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workflow ID
     *     responses:
     *       200:
     *         description: Workflow status retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 workflowId:
     *                   type: string
     *                   description: The ID of the workflow
     *                 status:
     *                   type: string
     *                   description: Current status of the workflow
     *                   enum: [Pending, Running, Completed, Failed]
     *       404:
     *         description: Workflow not found
     *       500:
     *         description: Internal server error
     */
    router.get('/:id/status', async (req, res) => {
        return workflowController.getWorkflowStatus(req, res);
    });

    return router;
}