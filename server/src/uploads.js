const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('./db');

const dir = path.join(DATA_DIR, 'uploads');
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, f, cb) => cb(null, crypto.randomBytes(14).toString('hex') + EXT[f.mimetype]),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, f, cb) => EXT[f.mimetype] ? cb(null, true) : cb(new Error('Only PNG, JPG or WEBP images are allowed')),
});
const billDir = path.join(DATA_DIR, 'bills');          // private folder: NOT exposed via /uploads
fs.mkdirSync(billDir, { recursive: true });
const uploadBill = multer({
  storage: multer.diskStorage({
    destination: billDir,
    filename: (req, f, cb) => cb(null, crypto.randomBytes(14).toString('hex') + EXT[f.mimetype]),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },                // phone photos can be large
  fileFilter: (req, f, cb) => EXT[f.mimetype] ? cb(null, true) : cb(new Error('Only PNG, JPG or WEBP images are allowed')),
});
const rmBill = (name) => { if (name) fs.unlink(path.join(billDir, path.basename(name)), () => {}); };
// Do not trust the browser-supplied type: check the real file signature (JPEG / PNG / WEBP)
function looksLikeImage(file) {
  try {
    const fd = fs.openSync(path.join(billDir, file.filename), 'r');
    const b = Buffer.alloc(12); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd);
    const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
    return jpg || png || webp;
  } catch { return false; }
}
const rmUpload = (name) => { if (name) fs.unlink(path.join(dir, path.basename(name)), () => {}); };
module.exports = { upload, rmUpload, uploadBill, rmBill, billDir, looksLikeImage };
