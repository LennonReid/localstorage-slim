import { ls } from './ls';

describe('LS wrapper', () => {
  afterEach(() => {
    global.localStorage.clear();
  });

  it('Calling get() with non-existent key should return null', () => {
    expect(ls.get('some_key')).toBe(null);
  });

  it('Calling set() with/without ttl should return undefined', () => {
    expect(ls.set('some_key', 'some_value')).toBe(undefined);
    expect(ls.set('some_key1', 'some_value1', 3)).toBe(undefined);
  });

  it('LS should set(), get() correct value (with/without ttl)', async () => {
    // string values
    ls.set('some_key', 'some_value');
    expect(ls.get('some_key')).toBe('some_value');
    ls.set('some_key1', 'some_value1', 3);
    expect(ls.get('some_key1')).toBe('some_value1');

    // objects
    const inputObj = {
      a: null,
      b: undefined,
      c: 'xyz',
      d: new Date('2021/2/27 11:00:00 GMT').toUTCString(),
      e: ['x', 1, { z: false }],
    };
    const outputObj = {
      a: null,
      c: 'xyz',
      d: 'Sat, 27 Feb 2021 11:00:00 GMT',
      e: ['x', 1, { z: false }],
    };
    ls.set('some_object', inputObj);
    expect(ls.get('some_object')).toStrictEqual(outputObj);
    ls.set('some_object', inputObj, 3);
    expect(ls.get('some_object')).toStrictEqual(outputObj);

    // arrays
    const inputArr = [
      'a',
      1,
      null,
      true,
      false,
      undefined,
      new Date('2021/2/27 11:00:00 GMT').toUTCString(),
      { x: undefined, y: 'yellow' },
    ];
    const outputArr = ['a', 1, null, true, false, null, 'Sat, 27 Feb 2021 11:00:00 GMT', { y: 'yellow' }];
    ls.set('some_array', inputArr);
    expect(ls.get('some_array')).toStrictEqual(outputArr);
    ls.set('some_array', inputArr, 3);
    expect(ls.get('some_array')).toStrictEqual(outputArr);

    // exceptional cases: setting ttl as value inside an object
    const exp = {
      ttl: 3,
      value: 'xyz',
    };

    ls.set('some_object', exp);
    expect(ls.get('some_object')).toStrictEqual(exp);
    ls.set('some_object', exp, 1);
    expect(ls.get('some_object')).toStrictEqual(exp);

    // should expire after 1s and not after 3s
    await new Promise((res) => setTimeout(res, 1100));
    expect(ls.get('some_object')).toBe(null);
  });

  it('Calling get() should return null after ttl expires', async () => {
    ls.set('some_key', 'some_value', 1);
    expect(ls.get('some_key')).toBe('some_value');

    await new Promise((res) => setTimeout(res, 1100));
    expect(ls.get('some_key')).toBe(null);
  });

  it('Calling get() should return null after global ttl expires', async () => {
    ls.config.global_ttl = 1;
    ls.set('some_key', 'some_value', 1);
    expect(ls.get('some_key')).toBe('some_value');

    await new Promise((res) => setTimeout(res, 1100));
    expect(ls.get('some_key')).toBe(null);
  });

  it('ttl should take precedence over global_ttl', async () => {
    ls.config.global_ttl = 1;
    ls.set('some_key', 'some_value', 2);
    expect(ls.get('some_key')).toBe('some_value');

    // after global_ttl
    await new Promise((res) => setTimeout(res, 1100));
    expect(ls.get('some_key')).toBe('some_value');

    // after ttl
    await new Promise((res) => setTimeout(res, 1000));
    expect(ls.get('some_key')).toBe(null);
  });
});
