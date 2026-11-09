import { formatBusQr, parseBusQr } from '../busQr';
import { resolveScan, scanProblemText } from '../resolveScan';

describe('formato del QR', () => {
  it('genera mibus://bus/v1/<código>', () => {
    expect(formatBusQr('prueba-p3-01')).toBe('mibus://bus/v1/PRUEBA-P3-01');
    expect(() => formatBusQr('con espacio')).toThrow();
    expect(() => formatBusQr('-MAL')).toThrow();
  });

  it('lee el QR, tolerando mayúsculas, espacios y "/" final', () => {
    expect(parseBusQr('mibus://bus/v1/PRUEBA-P3-01')).toEqual({ ok: true, code: 'PRUEBA-P3-01' });
    expect(parseBusQr('  MIBUS://BUS/V1/prueba-p3-01/ \n')).toEqual({
      ok: true,
      code: 'PRUEBA-P3-01',
    });
    expect(parseBusQr(formatBusQr('T2-7'))).toEqual({ ok: true, code: 'T2-7' });
  });

  it.each([
    ['https://www.unicordoba.edu.co', 'not_mibus'],
    ['P3-014', 'not_mibus'],
    ['mibus://bus/v2/P3-014', 'unsupported_version'],
    ['mibus://bus/P3-014', 'unsupported_version'],
    ['mibus://bus/v1/', 'bad_code'],
    ['mibus://bus/v1/P3 014', 'bad_code'],
    ['mibus://bus/v1/P3-014/extra', 'bad_code'],
    [`mibus://bus/v1/${'A'.repeat(33)}`, 'bad_code'],
  ])('rechaza %s (%s)', (data, reason) => {
    expect(parseBusQr(data)).toEqual({ ok: false, reason });
  });
});

describe('resolveScan', () => {
  const bus = { id: 'b1', code: 'PRUEBA-P3-01', routeId: 'P3' };
  const lookup = jest.fn(async (code: string) => (code === bus.code ? bus : null));

  it('bus de la ruta elegida: se vincula', async () => {
    expect(await resolveScan('mibus://bus/v1/prueba-p3-01', 'P3', lookup)).toEqual({
      kind: 'linked',
      bus,
    });
    expect(lookup).toHaveBeenCalledWith('PRUEBA-P3-01');
  });

  it('bus de otra ruta: pregunta', async () => {
    expect(await resolveScan('mibus://bus/v1/PRUEBA-P3-01', 'T2', lookup)).toEqual({
      kind: 'other_route',
      bus,
    });
  });

  it('bus no registrado o inactivo', async () => {
    const outcome = await resolveScan('mibus://bus/v1/NO-EXISTE', 'P3', lookup);
    expect(outcome).toEqual({ kind: 'invalid', reason: 'unknown_bus' });
    expect(scanProblemText(outcome as never).title).toBe('Bus no registrado');
  });

  it('un QR ajeno no consulta el servidor', async () => {
    lookup.mockClear();
    expect(await resolveScan('https://ejemplo.com', 'P3', lookup)).toMatchObject({
      kind: 'invalid',
      reason: 'not_mibus',
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('sin backend o sin conexión', async () => {
    expect(await resolveScan('mibus://bus/v1/X1', 'P3', null)).toEqual({
      kind: 'error',
      reason: 'no_backend',
    });
    const offline = jest.fn(async () => {
      throw new Error('offline');
    });
    expect(await resolveScan('mibus://bus/v1/X1', 'P3', offline)).toEqual({
      kind: 'error',
      reason: 'network',
    });
  });
});
