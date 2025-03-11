import { Feature, Polygon } from 'geojson';
import booleanWithin from '@turf/boolean-within';

import { Job } from './Job';
import { Task } from '../models/Task';
import countryMapping from '../data/world_data.json';

/**
 * DataAnalysisJob implements the Job interface to determine which country
 * a given geographic feature belongs to.
 * 
 * This job analyzes geographic data (in GeoJSON format) and identifies
 * the country that contains the provided geometry.
 */
export class DataAnalysisJob implements Job {
    /**
     * Executes the data analysis task to determine which country contains the provided geometry.
     * 
     * @param task - The task containing GeoJSON data to analyze
     * @returns A Promise resolving to the name of the country containing the geometry,
     *          or 'No country found' if the geometry is not within any known country
     * 
     * @throws Will throw an error if the task.geoJson cannot be parsed as valid GeoJSON
     * @throws Will throw an error if the input geometry is not a valid Polygon feature
     */
    async run(task: Task): Promise<string> {
        const inputGeometry: Feature<Polygon> = JSON.parse(task.geoJson);

        for (const countryFeature of countryMapping.features) {
            if (countryFeature.geometry.type === 'Polygon' || countryFeature.geometry.type === 'MultiPolygon') {
                const isWithin = booleanWithin(inputGeometry, countryFeature as Feature<Polygon>);
                if (isWithin) {
                    return countryFeature.properties?.name;
                }
            }
        }
        return 'No country found';
    }
}