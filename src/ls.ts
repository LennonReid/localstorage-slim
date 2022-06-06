/*
 * https://github.com/niketpathak/localstorage-slim
 * Copyright (c) 2021 Niket Pathak
 * MIT License
 */

import { isObject, NOOP } from './helpers';
import type { Encrypter, Decrypter, LocalStorageConfig } from './types';

// private flags
let hasLS: boolean;

const supportsLS = (): boolean => {
  if (hasLS !== undefined) return hasLS;
  hasLS = true;

  try {
    if (!localStorage) {
      hasLS = false;
    }
  } catch {
    // some browsers throw an error if you try to access local storage (e.g. brave browser)
    // and some like Safari do not allow access to LS in incognito mode
    hasLS = false;
  }

  // poll/flush/setup callbacks on init
  poll();

  return hasLS;
};

// Apex
const APX = String.fromCharCode(0);

// tiny obsfuscator
const obfus: Encrypter | Decrypter = (str, key, encrypt = true) =>
  encrypt
    ? [...((JSON.stringify(str) as unknown) as string[])]
      .map((x) => String.fromCharCode(x.charCodeAt(0) + (key as number)))
      .join('')
    : JSON.parse([...(str as string[])].map((x) => String.fromCharCode(x.charCodeAt(0) - (key as number))).join(''));

const decrypter: Decrypter = (str, key) => {
  return obfus(str, key, false);
};

// Callback polling
let cbRefs: NodeJS.Timeout[] = [];
const poll = (forceFlush = false): void => {
  cbRefs.forEach((ref) => clearTimeout(ref));
  cbRefs = [];
  flush(forceFlush);
};

const config: LocalStorageConfig = {
  ttl: null,
  encrypt: false,
  encrypter: obfus,
  decrypter,
  secret: 75,
};

const set = <T = unknown>(key: string, value: T, localConfig: LocalStorageConfig = {}): void | boolean => {
  if (!supportsLS()) return false;

  const _conf = {
    ...config,
    ...localConfig,
    encrypt: localConfig.encrypt === false ? false : localConfig.encrypt || config.encrypt,
    ttl: localConfig.ttl === null ? null : localConfig.ttl || config.ttl,
  };

  try {
    const hasTTL = _conf.ttl && !isNaN(_conf.ttl) && _conf.ttl > 0;
    let val = hasTTL ? { [APX]: value, ttl: Date.now() + (_conf.ttl as number) * 1e3 } : value;

    if (_conf.encrypt) {
      // if ttl exists, only encrypt the value
      if (hasTTL) {
        (val as Record<string, unknown>)[APX] = (_conf.encrypter || NOOP)(
          (val as Record<string, unknown>)[APX],
          _conf.secret
        ) as string;
      } else {
        val = (_conf.encrypter || NOOP)(val, _conf.secret) as T;
      }
    }

    // If a callback was specified store it
    if (hasTTL && typeof _conf.cb === 'function') {
      (val as Record<string, unknown>).cb = `${_conf.cb}`;
    }

    localStorage.setItem(key, JSON.stringify(val));

    hasTTL && poll();
  } catch {
    // Sometimes stringify fails due to circular refs
    return false;
  }
};

const get = <T = unknown>(key: string, localConfig: LocalStorageConfig = {}): T | null => {
  if (!supportsLS()) return null;

  const str = localStorage.getItem(key);

  if (!str) {
    return null;
  }

  const _conf = {
    ...config,
    ...localConfig,
    encrypt: localConfig.encrypt === false ? false : localConfig.encrypt || config.encrypt,
    ttl: localConfig.ttl === null ? null : localConfig.ttl || config.ttl,
  };

  let item = JSON.parse(str);
  const hasTTL = isObject(item) && APX in item;

  if (_conf.decrypt || _conf.encrypt) {
    try {
      if (hasTTL) {
        item[APX] = (_conf.decrypter || NOOP)(item[APX], _conf.secret) as string;
      } else {
        item = (_conf.decrypter || NOOP)(item, _conf.secret) as string;
      }
    } catch {
      // Either the secret is incorrect or there was a parsing error
      // do nothing [i.e. return the encrypted/unparsed value]
    }
  }

  // if not using ttl, return immediately
  if (!hasTTL) {
    return item;
  }

  if (Date.now() > item.ttl) {
    localStorage.removeItem(key);
    return null;
  }

  return item[APX];
};

const flush = (force = false): false | void => {
  if (!supportsLS()) return false;
  Object.keys(localStorage).forEach((key) => {
    const str = localStorage.getItem(key);
    if (!str) return; // continue iteration
    let item;
    try {
      item = JSON.parse(str);
    } catch {
      // Some packages write strings to localStorage that are not converted by JSON.stringify(), so we need to ignore it
      return;
    }

    // if ttl is set
    if (isObject(item) && APX in item) {
      // flush if has/has not expired
      if (Date.now() > item.ttl || force) {
        localStorage.removeItem(key);
      } else if (item.cb) {
        // setup callback
        const cb = new Function('key', `localStorage.removeItem(key);(${item.cb})(key)`);
        cbRefs.push((setTimeout(cb, item.ttl - Date.now(), key) as unknown) as NodeJS.Timeout);
      }
    }
  });
};

const remove = (key: string): undefined | false => {
  if (!supportsLS()) return false;
  localStorage.removeItem(key);
};

const clear = (): undefined | false => {
  if (!supportsLS()) return false;
  localStorage.clear();
};

export default {
  config,
  set,
  get,
  clear,
  remove,
  poll,
};
