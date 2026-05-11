import {
  SERVICE_UUID,
  WRITE_UUID,
  NOTIFY_UUID,
  makeCleanFlashCommand,
  makeStartCommand,
  makeEndCommand,
  makeRowPacket,
  makeEndOfDataMarker,
  makeImageUpdateTimeCommand,
  makeUpdateImageCommand,
} from './protocol.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export class InkakoDevice {
  constructor() {
    this.device = null;
    this.server = null;
    this.writeChar = null;
    this.notifyChar = null;
    this._notifyHandler = null;
    this._onValueChanged = (event) => {
      const dv = event.target.value;
      const data = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      if (this._notifyHandler) this._notifyHandler(data);
    };
    this._onDisconnected = () => {
      this.server = null;
      this.writeChar = null;
      this.notifyChar = null;
      if (this.onDisconnect) this.onDisconnect();
    };
  }

  isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  get connected() {
    return !!(this.device && this.device.gatt && this.device.gatt.connected);
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome on desktop or Android.');
    }
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'NDB-8' }],
      optionalServices: [SERVICE_UUID],
    });
    this.device.addEventListener('gattserverdisconnected', this._onDisconnected);
    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(SERVICE_UUID);
    this.writeChar = await service.getCharacteristic(WRITE_UUID);
    this.notifyChar = await service.getCharacteristic(NOTIFY_UUID);
    this.notifyChar.addEventListener('characteristicvaluechanged', this._onValueChanged);
    await this.notifyChar.startNotifications();
    return { name: this.device.name || '(unnamed)', id: this.device.id };
  }

  async disconnect() {
    if (this.notifyChar) {
      try {
        await this.notifyChar.stopNotifications();
      } catch {
        // ignore
      }
      this.notifyChar.removeEventListener('characteristicvaluechanged', this._onValueChanged);
    }
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
  }

  setNotifyHandler(fn) {
    this._notifyHandler = fn;
  }

  async write(data) {
    if (!this.writeChar) throw new Error('Not connected');
    return this.writeChar.writeValueWithoutResponse(data);
  }
}

export async function transferImage(device, imageData, {
  screenInfo = 8,
  imageIndex = 1,
  width = 428,
  rowDelayMs = 50,
  log = () => {},
  onProgress = () => {},
  signal = null,
} = {}) {
  if (!device.connected) throw new Error('Device is not connected');

  const rowSize = Math.floor(width / 4);
  const totalRows = Math.ceil(imageData.length / rowSize);
  const checkAbort = () => {
    if (signal && signal.aborted) throw new Error('Aborted');
  };

  let startAck = deferred();
  let endAck = deferred();
  let updateTimeAck = deferred();
  let errorReported = false;
  let lastErrorRow = -1;

  device.setNotifyHandler((data) => {
    if (data.length === 0) return;
    const b0 = data[0];
    const b1 = data.length > 1 ? data[1] : 0;
    const b2 = data.length > 2 ? data[2] : 0;
    if (b0 === 0xab && data.length >= 6 && b2 !== 0xff && data[5] === 0x00) {
      lastErrorRow = (data[2] << 8) | data[3];
      errorReported = true;
      log(`Transfer error reported at row ${lastErrorRow} — will retry from row 0`);
    } else if (b0 === 0x6b) {
      if (b1 === 0x01 && b2 === 0x08) {
        log('Received start ACK');
        startAck.resolve();
      } else if (b1 === 0x01 && b2 === 0x06) {
        log('Received end ACK');
        endAck.resolve();
      } else if (b1 === 0x17) {
        updateTimeAck.resolve();
      } else if (b1 === 0x01 && b2 === 0x01) {
        log('Device busy (display refreshing)');
      }
    }
  });

  try {
    log('Sending clean flash...');
    await device.write(makeCleanFlashCommand());
    await sleep(50);
    checkAbort();

    log(`Sending start command (${imageData.length} bytes, ${totalRows} rows)...`);
    await device.write(makeStartCommand(imageIndex, screenInfo, imageData.length));

    log('Waiting for start ACK...');
    await Promise.race([
      startAck.promise,
      sleep(10000).then(() => { throw new Error('Timeout waiting for start ACK'); }),
    ]);
    checkAbort();

    let currentRow = 0;
    let retryCount = 0;
    const maxRetries = 3;

    while (currentRow < totalRows) {
      checkAbort();
      if (errorReported) {
        errorReported = false;
        retryCount += 1;
        if (retryCount > maxRetries) {
          throw new Error(`Max retries (${maxRetries}) exceeded`);
        }
        log(`Retrying from row 0 (attempt ${retryCount}/${maxRetries})`);
        currentRow = 0;
        await sleep(2000);
        continue;
      }

      const offset = currentRow * rowSize;
      const chunk = imageData.subarray(offset, Math.min(offset + rowSize, imageData.length));
      const packet = makeRowPacket(imageIndex, currentRow + 1, chunk);
      await device.write(packet);
      currentRow += 1;
      onProgress(currentRow, totalRows);

      if (currentRow < totalRows) {
        await sleep(rowDelayMs);
      }
    }

    log('Sending end-of-data marker...');
    await device.write(makeEndOfDataMarker(imageIndex));
    await sleep(100);

    log('Sending end command...');
    await device.write(makeEndCommand(imageIndex, screenInfo));
    await Promise.race([
      endAck.promise,
      sleep(30000).then(() => { throw new Error('Timeout waiting for end ACK'); }),
    ]);
    checkAbort();

    log('Disabling carousel auto-refresh...');
    await device.write(makeImageUpdateTimeCommand(0));
    await Promise.race([
      updateTimeAck.promise,
      sleep(5000),
    ]);

    log('Sending refresh command...');
    await device.write(makeUpdateImageCommand());
    await sleep(2000);

    log('Transfer complete!');
    return true;
  } finally {
    device.setNotifyHandler(null);
  }
}
