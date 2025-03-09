import { Feature, Polygon } from 'geojson';
import booleanWithin from '@turf/boolean-within';

import { Job } from './Job';
import { Task } from '../models/Task';
import countryMapping from '../data/world_data.json';

export class DataAnalysisJob implements Job {
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