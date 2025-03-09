import * as fs from 'fs';
import { Repository } from 'typeorm';

import { Task } from '../../models/Task';
import { Workflow } from '../../models/Workflow';
import { WorkflowFactory } from '../../workflows/WorkflowFactory';

jest.mock('fs');

describe('WorkflowFactory with dependencies', () => {
    let workflowFactory: WorkflowFactory;
    let mockTaskRepository: Repository<Task>;
    let mockWorkflowRepository: Repository<Workflow>;

    beforeEach(() => {
        mockTaskRepository = {
            save: jest.fn().mockImplementation(task => Promise.resolve({ ...task, taskId: 'task-id' })),
        } as unknown as Repository<Task>;

        mockWorkflowRepository = {
            save: jest.fn().mockImplementation(workflow =>
                Promise.resolve({ ...workflow, workflowId: 'workflow-id' })
            ),
        } as unknown as Repository<Workflow>;

        workflowFactory = new WorkflowFactory(
            mockWorkflowRepository,
            mockTaskRepository
        );
    });

    describe('createWorkflowFromYaml', () => {
        it('should parse task dependencies from YAML', async () => {
            // Arrange
            const yamlContent = `
        name: "workflow_with_dependencies"
        steps:
          - taskType: "analysis"
            stepNumber: 1
          - taskType: "polygonArea"
            stepNumber: 2
            dependsOn: 1
          - taskType: "reportGeneration"
            stepNumber: 3
            dependsOn: 2
      `;

            (fs.readFileSync as jest.Mock).mockReturnValue(yamlContent);

            // Act
            const workflow = await workflowFactory.createWorkflowFromYaml('workflow.yml');

            // Assert
            expect(mockWorkflowRepository.save).toHaveBeenCalled();
            expect(mockTaskRepository.save).toHaveBeenCalledTimes(3);

            // Verify the dependencies were set correctly
            const saveArgs = (mockTaskRepository.save as jest.Mock).mock.calls;
            expect(saveArgs[0][0].dependsOn).toBeUndefined();
            expect(saveArgs[1][0].dependsOn).toBe('task-id'); // Second task depends on first task
            expect(saveArgs[2][0].dependsOn).toBe('task-id'); // Third task depends on second task
        });

        it('should handle missing dependencies gracefully', async () => {
            // Arrange
            const yamlContent = `
        name: "workflow_without_dependencies"
        steps:
          - taskType: "analysis"
            stepNumber: 1
          - taskType: "polygonArea"
            stepNumber: 2
          - taskType: "reportGeneration"
            stepNumber: 3
      `;

            (fs.readFileSync as jest.Mock).mockReturnValue(yamlContent);

            // Act
            const workflow = await workflowFactory.createWorkflowFromYaml('workflow.yml');

            // Assert
            expect(mockWorkflowRepository.save).toHaveBeenCalled();
            expect(mockTaskRepository.save).toHaveBeenCalledTimes(3);

            // Verify no dependencies were set
            const saveArgs = (mockTaskRepository.save as jest.Mock).mock.calls;
            expect(saveArgs[0][0].dependsOn).toBeUndefined();
            expect(saveArgs[1][0].dependsOn).toBeUndefined();
            expect(saveArgs[2][0].dependsOn).toBeUndefined();
        });

        it('should throw an error for invalid dependency reference', async () => {
            // Arrange
            const yamlContent = `
        name: "workflow_with_invalid_dependencies"
        steps:
          - taskType: "analysis"
            stepNumber: 1
          - taskType: "polygonArea"
            stepNumber: 2
            dependsOn: 5 # Invalid step number
      `;

            (fs.readFileSync as jest.Mock).mockReturnValue(yamlContent);

            // Act & Assert
            await expect(workflowFactory.createWorkflowFromYaml('workflow.yml'))
                .rejects.toThrow('Invalid dependency reference');
        });
    });
});