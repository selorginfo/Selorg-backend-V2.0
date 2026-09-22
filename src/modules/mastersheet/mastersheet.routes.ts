import { Router } from 'express';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import * as ctrl from './mastersheet.controller';

const router = Router();
router.use(authenticateAdmin);

/* ── Template download ───────────────────────────────────────────────── */
router.get('/template', ctrl.downloadAllTemplate);

/* ── Two-step upload: prepare → process each sheet → finalize/activate ─ */
router.post('/prepare', ctrl.uploadMiddleware, ctrl.prepareUpload);
router.post('/process/:sheet', ctrl.processSheetByJob);
router.post('/finalize', ctrl.finalizeImport);
router.get('/active', ctrl.getActiveVersion);

/* ── Upload history ──────────────────────────────────────────────────── */
router.post('/history', ctrl.saveHistory);
router.get('/history', ctrl.getHistory);

export default router;
