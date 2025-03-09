import { Task } from '../../src/models/Task';

describe('Task entity with dependencies', () => {
    it('should include dependency field', () => {
        // Arrange
        const task = new Task();
        task.taskId = 'test-task';
        task.dependsOn = 'dependent-task';

        // Act & Assert
        expect(task.dependsOn).toBe('dependent-task');
    });
});