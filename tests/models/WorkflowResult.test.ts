import { Workflow } from '../../src/models/Workflow';

describe('Workflow entity with finalResult', () => {
    it('should include finalResult field', () => {
        // Arrange
        const workflow = new Workflow();
        workflow.workflowId = 'test-workflow';
        workflow.finalResult = JSON.stringify({ summary: 'Test result' });

        // Act & Assert
        expect(workflow.finalResult).toBe(JSON.stringify({ summary: 'Test result' }));
    });
});