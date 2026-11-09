/// <reference types="node" />
// Prueba de integración contra el Supabase LOCAL (no corre en `npm test` ni en el CI).
//   npm run db:start && npm run db:reset && npm run test:integration
import { execSync } from 'node:child_process';

import { createClient } from '@supabase/supabase-js';

import dataset from '../../data/dataset.json';
import type { Database } from '../database.types';
import type { AppSupabaseClient } from '../supabase';
import {
  deleteMyData,
  endSharedTrip,
  ensureAnonymousSession,
  fetchRouteLiveBuses,
  fetchRouteLiveStatus,
  fetchLiveIncidents,
  fetchLiveOccupancy,
  fetchTransitDataset,
  lookupBus,
  IncidentLimitError,
  OccupancyLimitError,
  reportIncident,
  reportOccupancy,
  PositionRejectedError,
  sendTripPosition,
  startSharedTrip,
  TripClosedError,
} from '../transit';

function localConfig() {
  const env = execSync('npx supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const get = (name: string) => new RegExp(`^${name}="?([^"\\r\\n]*)"?`, 'm').exec(env)?.[1];
  const url = get('API_URL');
  const key = get('PUBLISHABLE_KEY') || get('ANON_KEY');
  if (!url || !key) throw new Error('Supabase local no está corriendo (npm run db:start)');
  return { url, key };
}

const newClient = (): AppSupabaseClient => {
  const { url, key } = localConfig();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

jest.setTimeout(60_000);

describe('backend local', () => {
  it('el catálogo del servidor es igual al incluido en la app', async () => {
    const remote = await fetchTransitDataset(newClient());
    const byId = <T extends { id: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect({ ...remote, stops: byId(remote.stops) }).toEqual({
      ...dataset,
      stops: byId(dataset.stops),
    });
  });

  it('viaje anónimo: compartir, reportar cupo, ver el agregado y borrar mis datos', async () => {
    const client = newClient();
    const userId = await ensureAnonymousSession(client);

    const { data: trip, error } = await client
      .from('shared_trips')
      .insert({ route_id: 'S1' })
      .select('id, user_id')
      .single();
    expect(error).toBeNull();
    expect(trip?.user_id).toBe(userId);

    const position = await client.from('trip_positions').insert({
      trip_id: trip!.id,
      recorded_at: new Date().toISOString(),
      location: 'SRID=4326;POINT(-75.866 8.75)',
    });
    expect(position.error).toBeNull();
    const report = await client
      .from('occupancy_reports')
      .insert({ trip_id: trip!.id, route_id: 'S1', level: 'empty' });
    expect(report.error).toBeNull();

    // Otro usuario (sin sesión) ve el agregado, no el viaje.
    const anon = newClient();
    const status = await fetchRouteLiveStatus(anon, 'S1');
    expect(status.activeTrips).toBe(1);
    expect(status.position).toMatchObject({ latitude: 8.75, longitude: -75.866 });
    expect(status.occupancy?.level).toBe('empty');
    const peek = await anon.from('trip_positions').select('*');
    expect(peek.data ?? []).toEqual([]);

    await deleteMyData(client);
    const after = await fetchRouteLiveStatus(anon, 'S1');
    expect(after.activeTrips).toBe(0);
  });

  it('compartir en vivo: dos viajeros en el mismo bus se ven como un solo bus', async () => {
    const a = newClient();
    const b = newClient();
    const anon = newClient();
    const position = (latitude: number, longitude: number) => ({
      latitude,
      longitude,
      recordedAt: new Date(),
      speedMps: 6,
      accuracyM: 10,
    });

    const tripA = await startSharedTrip(a, 'D1');
    const tripB = await startSharedTrip(b, 'D1');
    await sendTripPosition(a, tripA, position(8.76, -75.88));
    await sendTripPosition(b, tripB, position(8.7602, -75.88));

    const buses = await fetchRouteLiveBuses(anon, 'D1');
    expect(buses).toEqual([
      { latitude: 8.7601, longitude: -75.88, travelers: 2, at: expect.any(Date) },
    ]);

    // Fuera de Montería o con la hora desfasada, el servidor la rechaza con el motivo.
    await new Promise((r) => setTimeout(r, 3_100)); // límite: una posición cada 3 s
    await expect(sendTripPosition(a, tripA, position(10.39, -75.48))).rejects.toMatchObject({
      name: 'PositionRejectedError',
      reason: 'outside_area',
    });
    await expect(
      sendTripPosition(a, tripA, {
        ...position(8.76, -75.88),
        recordedAt: new Date(Date.now() - 60 * 60_000),
      }),
    ).rejects.toMatchObject({ reason: 'clock' });
    await expect(sendTripPosition(a, tripA, position(8.76, -75.88))).resolves.toBeUndefined();
    await expect(sendTripPosition(a, tripA, position(8.76, -75.88))).rejects.toBeInstanceOf(
      PositionRejectedError,
    );

    // Volver a empezar cierra el viaje anterior (solo uno activo por persona).
    const tripA2 = await startSharedTrip(a, 'D1');
    expect(tripA2).not.toBe(tripA);
    await expect(sendTripPosition(a, tripA, position(8.76, -75.88))).rejects.toBeInstanceOf(
      TripClosedError,
    );

    await endSharedTrip(a, tripA2, 'auto_alighted');
    await endSharedTrip(b, tripB, 'user');
    expect(await fetchRouteLiveBuses(anon, 'D1')).toEqual([]);

    await deleteMyData(a);
    await deleteMyData(b);
  });

  it('QR del bus: se consulta sin sesión y el viaje queda vinculado solo a un bus de su ruta', async () => {
    const anon = newClient();
    const bus = await lookupBus(anon, 'PRUEBA-P2-01');
    expect(bus).toEqual({ id: expect.any(String), code: 'PRUEBA-P2-01', routeId: 'P2' });
    expect(await lookupBus(anon, 'NO-EXISTE')).toBeNull();

    const client = newClient();
    await expect(startSharedTrip(client, 'T2', bus!.id)).rejects.toThrow(
      'No se pudo empezar a compartir',
    );
    const tripId = await startSharedTrip(client, 'P2', bus!.id);
    const { data } = await client.from('shared_trips').select('bus_id').eq('id', tripId).single();
    expect(data?.bus_id).toBe(bus!.id);
    await deleteMyData(client);
  });

  it('cupo: un voto por viajero, por ruta y por buseta, con límite de 2 minutos', async () => {
    const anon = newClient();
    const bus = await lookupBus(anon, 'PRUEBA-AE-01');
    const a = newClient();
    const b = newClient();
    const tripA = await startSharedTrip(a, 'AE', bus!.id);
    const tripB = await startSharedTrip(b, 'AE');

    await reportOccupancy(a, tripA, 'AE', 'full');
    await reportOccupancy(b, tripB, 'AE', 'full');
    await expect(reportOccupancy(a, tripA, 'AE', 'empty')).rejects.toMatchObject({
      name: 'OccupancyLimitError',
      reason: 'too_soon',
    });
    await expect(reportOccupancy(a, tripA, 'AE', 'empty')).rejects.toBeInstanceOf(
      OccupancyLimitError,
    );

    const live = await fetchLiveOccupancy(anon);
    expect(live.byRoute.AE).toMatchObject({ level: 'full', reports: 2 });
    expect(live.byBus[bus!.id]).toMatchObject({ level: 'full', reports: 1 });

    await deleteMyData(a);
    await deleteMyData(b);
    expect((await fetchLiveOccupancy(anon)).byRoute.AE).toBeUndefined();
  });

  it('incidentes: quien va en el bus reporta; todos ven el aviso con la parada cercana', async () => {
    const anon = newClient();
    const a = newClient();
    const tripA = await startSharedTrip(a, 'RG');
    // Posición junto a una parada del seed para que el aviso diga "cerca de ...".
    const { data: stop } = await anon
      .from('stops')
      .select('name')
      .eq('id', 'calle22-cra6')
      .single();
    await sendTripPosition(a, tripA, {
      latitude: dataset.stops.find((s) => s.id === 'calle22-cra6')!.coordinate.latitude,
      longitude: dataset.stops.find((s) => s.id === 'calle22-cra6')!.coordinate.longitude,
      recordedAt: new Date(),
      speedMps: 0,
      accuracyM: 10,
    });

    await reportIncident(a, tripA, 'RG', 'broken_down');
    await expect(reportIncident(a, tripA, 'RG', 'broken_down')).rejects.toMatchObject({
      name: 'IncidentLimitError',
      reason: 'already_reported',
    });
    await expect(reportIncident(a, tripA, 'RG', 'broken_down')).rejects.toBeInstanceOf(
      IncidentLimitError,
    );

    const incidents = await fetchLiveIncidents(anon);
    expect(incidents.find((i) => i.routeId === 'RG')).toMatchObject({
      kind: 'broken_down',
      reports: 1,
      nearStop: stop!.name,
    });

    await deleteMyData(a);
    expect((await fetchLiveIncidents(anon)).find((i) => i.routeId === 'RG')).toBeUndefined();
  });
});
