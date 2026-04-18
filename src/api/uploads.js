const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

const digitisationUpload = [
  requireModule('foundry'),
  requirePermission('foundry.digitisation.edit')
];

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'products');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Shared disk storage (same folder, unique filenames)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `product-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_EXTS.includes(ext)) return cb(null, true);
    cb(new Error('Only image files are allowed (jpg, jpeg, png, webp, gif).'));
  }
});

const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (VIDEO_EXTS.includes(ext)) return cb(null, true);
    cb(new Error('Only video files are allowed (mp4, mov, webm, avi, mkv).'));
  }
});

// POST /api/uploads/product-image
router.post('/product-image', ...digitisationUpload, imageUpload.single('image'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    const url = `/uploads/products/${req.file.filename}`;
    return res.json({ success: true, data: { url, filename: req.file.filename } });
  } catch (err) { return next(err); }
});

// POST /api/uploads/product-video
router.post('/product-video', ...digitisationUpload, videoUpload.single('video'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No video file uploaded.' });
    const url = `/uploads/products/${req.file.filename}`;
    return res.json({ success: true, data: { url, filename: req.file.filename } });
  } catch (err) { return next(err); }
});

module.exports = router;
