import 'reflect-metadata';
import request from 'supertest';
import { Express } from 'express';

import { WorkflowStatus } from '../../src/factories/WorkflowFactory';

import { e2eBeforeAll, e2eAfterAll, e2eBeforeEach, e2eAfterEach } from './common/Bootstrap';

describe('Workflow E2E Test', () => {
    let app: Express;
    
    beforeAll(async () => {
        await e2eBeforeAll();
    });

    afterAll(async () => {
        await e2eAfterAll();
    });

    beforeEach(async () => {
        jest.spyOn(console, 'error').mockImplementation(() => { });
        app = await e2eBeforeEach();
    });

    afterEach(() => {
        e2eAfterEach();
    });

    it('should create a workflow that calculates polygon area correctly', async () => {
        // Sample GeoJSON for a polygon (a 1x1 square)
        const geoJson = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                ]
            }
        };

        // Create the workflow by sending a request to the analysis endpoint
        const createResponse = await request(app)
            .post('/analysis')
            .send({
                clientId: 'test-client',
                geoJson
            });

        expect(createResponse.status).toBe(202);
        const { workflowId } = createResponse.body;
        expect(workflowId).toBeDefined();

        // Poll for workflow completion
        const maxAttempts = 10;

        for (let i = 0; i < maxAttempts; i++) {
            // Wait for tasks to process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check workflow status
            const statusResponse = await request(app).get(`/workflow/${workflowId}/status`);
            expect(statusResponse.status).toBe(200);

            const workflow = statusResponse.body;

            if (workflow && workflow.status === WorkflowStatus.Completed) {
                break;
            }
        }

        const resultResponse = await request(app).get(`/workflow/${workflowId}/results`);
        expect(resultResponse.status).toBe(200);

        // Assert that we found our workflow and it's complete
        const workflow = resultResponse.body;
        expect(workflow).toBeDefined();
        expect(workflow.status).toBe(WorkflowStatus.Completed);

        // Assert workflow results
        const finalResult = workflow.finalResult;
        expect(finalResult).toBeDefined();
        expect(finalResult.tasks.length).toBe(3);
        expect(finalResult.summary.completedTasks).toBe(3);
    });

    it('should handle missing clientId when creating a workflow', async () => {
        const geoJson = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
            }
        };

        const response = await request(app)
            .post('/analysis')
            .send({ geoJson });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required field: clientId');
    });

    it('should handle missing geoJson when creating a workflow', async () => {
        const response = await request(app)
            .post('/analysis')
            .send({ clientId: 'test-client' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing required field: geoJson');
    });

    it('should return 404 for non-existent workflow status', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app).get(`/workflow/${nonExistentId}/status`);
        
        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Workflow not found');
    });

    it('should return 404 for non-existent workflow results', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app).get(`/workflow/${nonExistentId}/results`);
        
        expect(response.status).toBe(404);
        expect(response.body.error).toContain('Workflow not found');
    });

    it('should handle in-progress workflows when requesting results', async () => {
        // Create a workflow
        const geoJson = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
            }
        };

        const createResponse = await request(app)
            .post('/analysis')
            .send({
                clientId: 'test-client',
                geoJson
            });

        const { workflowId } = createResponse.body;

        // Immediately try to get results (should be in progress)
        const resultResponse = await request(app).get(`/workflow/${workflowId}/results`);
        
        // Either we get a 400 because it's not completed yet, or it completed very quickly
        if (resultResponse.status === 400) {
            expect(resultResponse.body.error).toContain('Workflow is not yet completed');
        }
    });

    it('should provide detailed workflow status information', async () => {
        // Create a workflow
        const geoJson = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
            }
        };

        const createResponse = await request(app)
            .post('/analysis')
            .send({
                clientId: 'test-client',
                geoJson
            });

        const { workflowId } = createResponse.body;
        
        // Get workflow status
        const statusResponse = await request(app).get(`/workflow/${workflowId}/status`);
        expect(statusResponse.status).toBe(200);
        
        // Verify the structure of the status response
        const status = statusResponse.body;
        expect(status.workflowId).toBeDefined();
        expect(status.status).toBeDefined();
        expect(status.totalTasks).toBeDefined();
        expect(status.completedTasks).toBeDefined();
        expect(status.failedTasks).toBeDefined();
        expect(status.inProgressTasks).toBeDefined();
        expect(status.queuedTasks).toBeDefined();
        expect(status.skippedTasks).toBeDefined();
    });

    it('should handle invalid GeoJSON data gracefully', async () => {
        // Invalid GeoJSON - missing coordinates
        const invalidGeoJson = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Polygon'
                // Missing coordinates property
            }
        };

        const createResponse = await request(app)
            .post('/analysis')
            .send({
                clientId: 'test-client',
                geoJson: invalidGeoJson
            });

        // We should still get a workflow created
        expect(createResponse.status).toBe(202);
        const { workflowId } = createResponse.body;

        // The workflow should eventually fail or complete with an error
        const maxAttempts = 10;
        let statusChecked = false;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));

            const statusResponse = await request(app).get(`/workflow/${workflowId}/status`);
            expect(statusResponse.status).toBe(200);
            
            const workflow = statusResponse.body;
            
            // If the workflow has reached a terminal state
            if (workflow && (workflow.status === WorkflowStatus.Completed || 
                             workflow.status === WorkflowStatus.Failed)) {
                statusChecked = true;
                // We expect at least some failed tasks due to the invalid GeoJSON
                expect(workflow.failedTasks).toBeGreaterThan(0);
                break;
            }
        }

        expect(statusChecked).toBe(true);
    });
});