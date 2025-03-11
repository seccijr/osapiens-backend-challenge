import { Job } from './Job';
import { Task } from '../models/Task';
import area from '@turf/area';
import { Position } from 'geojson';

/**
 * PolygonAreaJob calculates the area of GeoJSON polygons.
 * This job processes GeoJSON data from a task and calculates 
 * the area of Polygon or MultiPolygon geometries.
 * @implements {Job}
 */
export class PolygonAreaJob implements Job {
    /**
     * Executes the polygon area calculation job.
     * 
     * @param {Task} task - The task containing GeoJSON data to process
     * @returns {Promise<object>} A promise that resolves to an object containing:
     *   - area: The calculated area
     *   - areaInSquareMeters: The area in square meters
     *   - unit: The unit of measurement ('square meters')
     *   - For MultiPolygon, also includes:
     *     - areas: Array of individual polygon areas
     *     - totalArea: Sum of all polygon areas
     * @throws {Error} If geoJson field is missing or invalid
     * @throws {Error} If JSON parsing fails
     * @throws {Error} If GeoJSON structure is invalid
     * @throws {Error} If polygon coordinates are empty
     * @throws {Error} If geometry type is unsupported
     */
    async run(task: Task): Promise<any> {
        // Validate task data
        if (!task.geoJson) {
            throw new Error('Missing geoJson field');
        }

        let geoJsonData;
        try {
            geoJsonData = JSON.parse(task.geoJson);
        } catch (error) {
            throw new Error('Invalid JSON in geoJson field');
        }

        const geometry = geoJsonData.geometry;


        // Validate GeoJSON structure
        if (!geometry || !geometry.type || !geometry.coordinates) {
            throw new Error('Missing geoJson field');
        }

        // Calculate area based on GeoJSON type
        if (geometry.type === 'Polygon') {
            if (!geometry.coordinates.length) {
                throw new Error('Empty polygon coordinates');
            }

            const calculatedArea = area(geometry);
            return {
                area: calculatedArea,
                areaInSquareMeters: calculatedArea,
                unit: 'square meters'
            };
        } else if (geometry.type === 'MultiPolygon') {
            if (!geometry.coordinates.length) {
                throw new Error('Empty MultiPolygon coordinates');
            }

            const areas = geometry.coordinates.map((coords: Position[][]) => {
                const singlePolygon = {
                    type: 'Polygon',
                    coordinates: coords
                } as GeoJSON.Polygon;
                return area(singlePolygon);
            });

            const totalArea = areas.reduce((sum: number, currentArea: number) => sum + currentArea, 0);

            return {
                area: totalArea,
                areas,
                totalArea,
                areaInSquareMeters: totalArea,
                unit: 'square meters'
            };
        } else {
            throw new Error(`Unsupported GeoJSON type: ${geometry.type}`);
        }
    }
}