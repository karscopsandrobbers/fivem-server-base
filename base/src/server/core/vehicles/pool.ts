/* The one vehicle pool instance, in its own module so config.ts can reach it without a cycle. */
import EntityVehiclesPool from '../entities/VehiclesEntity';

export const vehiclesPool = new EntityVehiclesPool();
