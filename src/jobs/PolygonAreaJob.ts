import { Job } from './Job';
import { Task } from '../models/Task';
import area from '@turf/area';
import { Position } from 'geojson';

export class PolygonAreaJob implements Job {
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
        if (!geometry.type || !geometry.coordinates) {
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
