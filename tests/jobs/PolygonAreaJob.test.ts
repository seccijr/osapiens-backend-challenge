import { Task } from '../../src/models/Task';
import { TaskStatus } from '../../src/workers/TaskRunner';
import { PolygonAreaJob } from '../../src/jobs/PolygonAreaJob';

describe('PolygonAreaJob', () => {
    let job: PolygonAreaJob;
    let mockTask: Task;

    beforeEach(() => {
        job = new PolygonAreaJob();
        mockTask = {
            taskId: 'test-task-id',
            workflowId: 'test-workflow-id',
            taskType: 'polygonArea',
            status: TaskStatus.InProgress,
            data: JSON.stringify({
                geoJson: {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [0, 0],
                            [0, 1],
                            [1, 1],
                            [1, 0],
                            [0, 0]
                        ]
                    ]
                }
            }),
            progress: '',
        } as Task;
    });

    describe('run', () => {
        it('should calculate area from valid GeoJSON', async () => {
            // Arrange - setup in beforeEach

            // Act
            const result = await job.run(mockTask);

            // Assert
            expect(result).toBeDefined();
            expect(result.area).toBeGreaterThan(0);
            expect(result.areaInSquareMeters).toBeGreaterThan(0);
            expect(result.unit).toBe('square meters');
        });

        it('should handle GeoJSON with multiple polygons', async () => {
            // Arrange
            mockTask.data = JSON.stringify({
                geoJson: {
                    type: 'MultiPolygon',
                    coordinates: [
                        [
                            [
                                [0, 0],
                                [0, 1],
                                [1, 1],
                                [1, 0],
                                [0, 0]
                            ]
                        ],
                        [
                            [
                                [2, 2],
                                [2, 3],
                                [3, 3],
                                [3, 2],
                                [2, 2]
                            ]
                        ]
                    ]
                }
            });

            // Act
            const result = await job.run(mockTask);

            // Assert
            expect(result).toBeDefined();
            expect(result.area).toBeGreaterThan(0);
            expect(result.areas).toHaveLength(2);
            expect(result.totalArea).toBeGreaterThan(0);
        });

        it('should throw an error for invalid GeoJSON', async () => {
            // Arrange
            mockTask.data = JSON.stringify({
                geoJson: {
                    type: 'Invalid',
                    coordinates: []
                }
            });

            // Act & Assert
            await expect(job.run(mockTask)).rejects.toThrow();
        });

        it('should throw an error when geoJson field is missing', async () => {
            // Arrange
            mockTask.data = JSON.stringify({
                someOtherField: 'value'
            });

            // Act & Assert
            await expect(job.run(mockTask)).rejects.toThrow('Missing geoJson field');
        });

        it('should throw an error when task data is not valid JSON', async () => {
            // Arrange
            mockTask.data = 'not-valid-json';

            // Act & Assert
            await expect(job.run(mockTask)).rejects.toThrow();
        });

        it('should handle empty polygons gracefully', async () => {
            // Arrange
            mockTask.data = JSON.stringify({
                geoJson: {
                    type: 'Polygon',
                    coordinates: []
                }
            });

            // Act & Assert
            await expect(job.run(mockTask)).rejects.toThrow();
        });
    });
});