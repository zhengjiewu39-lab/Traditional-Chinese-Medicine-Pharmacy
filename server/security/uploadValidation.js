/**
 * Validation of uploaded prescription text files (kept in memory, never written to disk or served).
 * A file is accepted only if extension, declared MIME type and actual content all agree:
 *   - extension ∈ ALLOWED (txt, csv, json, xml) and MIME ∈ ALLOWED[ext]
 *   - content is valid UTF-8 text without NUL or other C0 control bytes (except tab, CR, LF)
 *   - content does not start with a known binary / executable signature
 *   - .json parses as JSON; .xml starts with '<'
 */

const path = require('path');

const MAX_BYTES = 1024 * 1024;

const ALLOWED = {
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
  '.json': ['application/json', 'text/plain'],
  '.xml': ['application/xml', 'text/xml'],
};

const BINARY_SIGNATURES = [
  Buffer.from('PK\x03\x04', 'latin1'),
  Buffer.from('MZ', 'latin1'),
  Buffer.from('\x7fELF', 'latin1'),
  Buffer.from('%PDF', 'latin1'),
  Buffer.from([0xcf, 0xfa, 0xed, 0xfe]),
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from('GIF8', 'latin1'),
  Buffer.from('#!', 'latin1'),
];

function validateUploadedText(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) return { error: 'no file content' };
  const ext = path.extname(String(file.originalname || '')).toLowerCase();
  if (!ALLOWED[ext]) return { error: `extension ${ext || '(none)'} not allowed` };
  const mime = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (!ALLOWED[ext].includes(mime)) return { error: `MIME type ${mime || '(none)'} does not match ${ext}` };
  const buf = file.buffer;
  if (buf.length === 0) return { error: 'empty file' };
  if (buf.length > MAX_BYTES) return { error: `file larger than ${MAX_BYTES} bytes` };
  if (BINARY_SIGNATURES.some((sig) => buf.subarray(0, sig.length).equals(sig))) return { error: 'binary or executable content' };
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return { error: 'content is not valid UTF-8 text' };
  }
  if (buf.some((b) => b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d)) return { error: 'content contains control characters' };
  const body = text.replace(/^\uFEFF/, '');
  if (ext === '.json') {
    try { JSON.parse(body); } catch { return { error: 'invalid JSON content' }; }
  }
  if (ext === '.xml' && !body.trimStart().startsWith('<')) return { error: 'invalid XML content' };
  return { value: body };
}

module.exports = { validateUploadedText, ALLOWED, MAX_BYTES };
