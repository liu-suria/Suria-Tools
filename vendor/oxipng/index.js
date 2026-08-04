import init, { optimise } from './squoosh_oxipng.js';

let ready;

async function ensureReady() {
  ready ||= init(new URL('./squoosh_oxipng_bg.wasm', import.meta.url));
  await ready;
}

export async function optimizePngBuffer(buffer, options = {}) {
  await ensureReady();
  const level = Math.max(1, Math.min(6, Number(options.level) || 3));
  const interlace = Boolean(options.interlace);
  const optimiseAlpha = Boolean(options.optimiseAlpha);
  const input = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const output = optimise(input, level, interlace, optimiseAlpha);
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}
