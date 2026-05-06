export const SERVICE_UUID = '79223401-1a11-21e1-8300-0940a1146603';
export const WRITE_UUID = '79223402-1a11-21e1-8300-0940a1146603';
export const NOTIFY_UUID = '79223403-1a11-21e1-8300-0940a1146603';

export const SCREEN_TYPES = {
  1: { width: 200, height: 200 },
  2: { width: 200, height: 200 },
  3: { width: 168, height: 384 },
  4: { width: 200, height: 300 },
  5: { width: 528, height: 768 },
  6: { width: 192, height: 176 },
  7: { width: 124, height: 250 },
  8: { width: 428, height: 428 },
};

export function checksum(bytes) {
  let s = 0;
  for (let i = 0; i < bytes.length; i++) s = (s + bytes[i]) & 0xff;
  return s;
}

function withChecksum(bytes) {
  const out = new Uint8Array(bytes.length + 1);
  out.set(bytes, 0);
  out[bytes.length] = checksum(bytes);
  return out;
}

export function makeCleanFlashCommand() {
  return withChecksum(new Uint8Array([0x6a, 0x16, 0x01, 0x01]));
}

export function makeStartCommand(imageIndex, screenInfo, dataLength) {
  const cmd = new Uint8Array([
    0x6a, 0x01, 0x08, 0x01, 0x04,
    imageIndex & 0xff,
    screenInfo & 0xff,
    (dataLength >>> 24) & 0xff,
    (dataLength >>> 16) & 0xff,
    (dataLength >>> 8) & 0xff,
    dataLength & 0xff,
  ]);
  return withChecksum(cmd);
}

export function makeEndCommand(imageIndex, screenInfo) {
  const cmd = new Uint8Array([
    0x6a, 0x01, 0x06, 0x00, 0x04,
    imageIndex & 0xff,
    screenInfo & 0xff,
    0x00, 0x00,
  ]);
  return withChecksum(cmd);
}

export function makeRowPacket(imageIndex, rowNum, rowData) {
  const out = new Uint8Array(5 + rowData.length + 1);
  out[0] = 0xaa;
  out[1] = imageIndex & 0xff;
  out[2] = (rowNum >>> 8) & 0xff;
  out[3] = rowNum & 0xff;
  out[4] = rowData.length & 0xff;
  out.set(rowData, 5);
  out[out.length - 1] = checksum(out.subarray(0, out.length - 1));
  return out;
}

export function makeEndOfDataMarker(imageIndex) {
  return new Uint8Array([0xaa, imageIndex & 0xff, 0xff, 0xff, 0x00]);
}

export function makeImageUpdateTimeCommand(intervalSeconds = 0) {
  const cmd = new Uint8Array([
    0x6a, 0x17, 0x02,
    (intervalSeconds >>> 8) & 0xff,
    intervalSeconds & 0xff,
  ]);
  return withChecksum(cmd);
}

export function makeUpdateImageCommand() {
  const cmd = new Uint8Array(21);
  cmd[0] = 0x6a;
  cmd[1] = 0x14;
  cmd[2] = 0x10;
  cmd[3] = 0x01;
  return withChecksum(cmd);
}

export function makeDevInfoCommand() {
  return withChecksum(new Uint8Array([0x6a, 0x15, 0x02, 0x00, 0x00]));
}

export function makeGetVersionCommand() {
  return withChecksum(new Uint8Array([0x6a, 0x11, 0x03, 0x00, 0x00, 0x00]));
}

export function makeGetBatteryCommand() {
  return withChecksum(new Uint8Array([0x6a, 0x18, 0x04, 0x00, 0x00, 0x00, 0x00]));
}
