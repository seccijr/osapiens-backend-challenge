import { Router } from 'express';

import { WorkflowController } from '../controllers/WorkflowController';

/**
 * Creates and configures the analysis router
 * @param {WorkflowController} workflowController - The controller handling workflow operations
 * @returns {Router} Express router configured with analysis endpoints
 */
export const createAnalysisRouter = (workflowController: WorkflowController) => {
    const router = Router();

    /**
     * Create a new analysis workflow
     * 
     * @route POST /analysis
     * 
     * @swagger
     * /analysis:
     *   post:
     *     summary: Create analysis workflow
     *     description: Creates a new geospatial analysis workflow using the provided client ID and GeoJSON data
     *     tags: [Workflows]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [clientId, geoJson]
     *             properties:
     *               clientId:
     *                 type: string
     *                 description: The client identifier
     *               geoJson:
     *                 type: object
     *                 description: GeoJSON data to be analyzed
     *             example:
     *               clientId: test-client
     *               geoJson:
     *                   value: {
     *                       type: 'Feature',
     *                       properties: {},
     *                       geometry: {
     *                           type: 'Polygon',
     *                           coordinates: [
     *                               [
     *                                   [0, 0],
     *                                   [1, 0],
     *                                   [1, 1],
     *                                   [0, 1],
     *                                   [0, 0]
     *                               ]
     *                           ]
     *                       }
     *                   }
     *     responses:
     *       202:
     *         description: Workflow created successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 workflowId:
     *                   type: string
     *                   description: The ID of the created workflow
     *                 message:
     *                   type: string
     *                   description: Success message
     *       400:
     *         description: Missing required fields
     *       500:
     *         description: Internal server error or configuration issue
     */
    router.post('/', async (req, res) => {
        await workflowController.createAnalysisWorkflow(req, res);
    });

    return router;
}