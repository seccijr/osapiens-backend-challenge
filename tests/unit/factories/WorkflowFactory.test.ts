import * as fs from 'fs';
import { Repository } from 'typeorm';

import { Task } from '../../../src/models/Task';
import { Workflow } from '../../../src/models/Workflow';
import { WorkflowFactory } from '../../../src/factories/WorkflowFactory';

jest.mock('fs');

describe('WorkflowFactory with dependencies', () => {
    const clientId = 'client-id';
    const geoJson = '{"type": "FeatureCollection", "features": []}';
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

    describe('createWorkflowFromYAML', () => {
        it('should parse task dependencies from YAML', async () => {
            // Arrange
            const yamlContent = `
        name: "workflow_with_dependencies"
        steps:
          - taskType: "analysis"
            stepNumber: 1
          - taskType: "polygonArea"
            stepNumber: 2
            dependencies:
              - 1
          - taskType: "reportGeneration"
            stepNumber: 3
            dependencies:
              - 2
      `;
            const task1Result = { taskId: 'task-1', taskType: 'analysis', stepNumber: 1 };
            const task2Result = { taskId: 'task-2', taskType: 'polygonArea', stepNumber: 2 };
            const task3Result = { taskId: 'task-3', taskType: 'reportGeneration', stepNumber: 3 };

            (fs.readFileSync as jest.Mock).mockReturnValue(yamlContent);
            (mockTaskRepository.save as jest.Mock)
                .mockImplementation((task) => {
                    const stepNumber = task.stepNumber;
                    if (stepNumber === 1) return Promise.resolve(task1Result);
                    if (stepNumber === 2) return Promise.resolve(task2Result);
                    if (stepNumber === 3) return Promise.resolve(task3Result);
                    return Promise.resolve(null);
                });

            // Act
            const workflow = await workflowFactory.createWorkflowFromYAML('workflow.yml', clientId, geoJson);

            // Assert
            expect(mockWorkflowRepository.save).toHaveBeenCalled();
            expect(mockTaskRepository.save).toHaveBeenCalledTimes(3);

            // Verify the dependencies were set correctly
            const saveArgs = (mockTaskRepository.save as jest.Mock).mock.calls;
            expect(saveArgs[0][0].dependencies).toBeUndefined();
            expect(saveArgs[1][0].dependencies).toEqual([task1Result]); // Second task depends on first task
            expect(saveArgs[2][0].dependencies).toEqual([task2Result]); // Third task depends on second task
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
            const workflow = await workflowFactory.createWorkflowFromYAML('workflow.yml', clientId, geoJson);

            // Assert
            expect(mockWorkflowRepository.save).toHaveBeenCalled();
            expect(mockTaskRepository.save).toHaveBeenCalledTimes(3);

            // Verify no dependencies were set
            const saveArgs = (mockTaskRepository.save as jest.Mock).mock.calls;
            expect(saveArgs[0][0].dependencies).toBeUndefined();
            expect(saveArgs[1][0].dependencies).toBeUndefined();
            expect(saveArgs[2][0].dependencies).toBeUndefined();
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
            dependencies:
              - 5 # Invalid step number
      `;

            (fs.readFileSync as jest.Mock).mockReturnValue(yamlContent);

            // Act & Assert
            await expect(workflowFactory.createWorkflowFromYAML('workflow.yml', clientId, geoJson))
                .rejects.toThrow('Invalid dependency reference');
        });

        it('should handle multiple dependencies for a task', async () => {
            // Arrange
            const yamlContent = `
        name: "workflow_with_multiple_dependencies"
        steps:
          - taskType: "analysis"
            stepNumber: 1
          - taskType: "dataPrep"
            stepNumber: 2
          - taskType: "reportGeneration"
            stepNumber: 3
            dependencies:
              - 1
              - 2
      `;
            const task1Result = { taskId: 'task-1', taskType: 'analysis', stepNumber: 1 };
            const task2Result = { taskId: 'task-2', taskType: 'dataPrep', stepNumber: 2 };
            const task3Result = { taskId: 'task-3', taskType: 'reportGeneration', stepNumber: 3 };

            (fs.readFileSync as jest.Mock).mockReturnValue(yamlContent);
            (mockTaskRepository.save as jest.Mock)
                .mockImplementation((task) => {
                    const stepNumber = task.stepNumber;
                    if (stepNumber === 1) return Promise.resolve(task1Result);
                    if (stepNumber === 2) return Promise.resolve(task2Result);
                    if (stepNumber === 3) return Promise.resolve(task3Result);
                    return Promise.resolve(null);
                });

            // Act
            const workflow = await workflowFactory.createWorkflowFromYAML('workflow.yml', clientId, geoJson);

            // Assert
            expect(mockWorkflowRepository.save).toHaveBeenCalled();
            expect(mockTaskRepository.save).toHaveBeenCalledTimes(3);

            // Verify the dependencies were set correctly
            const saveArgs = (mockTaskRepository.save as jest.Mock).mock.calls;
            expect(saveArgs[0][0].dependencies).toBeUndefined();
            expect(saveArgs[1][0].dependencies).toBeUndefined();
            expect(saveArgs[2][0].dependencies).toEqual([task1Result, task2Result]); // Third task depends on both first and second tasks
        });
    });
});