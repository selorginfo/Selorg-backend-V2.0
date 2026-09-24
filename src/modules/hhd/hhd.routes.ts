import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { protect, authorize } from './hhd.auth.middleware';
import { USER_ROLE } from './hhd.constants';
import { validate } from '../../middleware/validate.middleware';
import {
  sendOtpBodySchema,
  verifyOtpBodySchema,
  refreshBodySchema,
  updateOrderStatusBodySchema,
  assignOrderStatusBodySchema,
  scanItemBodySchema,
  scannedItemBodySchema,
  scanBagBodySchema,
  scanRackBodySchema,
  updateTaskBodySchema,
  markNotFoundBodySchema,
  heartbeatBodySchema,
  orderStatusParamSchema,
  paginationQuerySchema,
  substitutesQuerySchema,
  assignOrderBodySchema,
} from './hhd.validation';

import {
  sendOTP,
  resendOTP,
  verifyOTPHandler,
  getMe,
  logout,
  refreshSession,
} from './hhd.auth.controller';

import {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  getOrdersByStatus,
  getAssignOrdersByStatus,
  updateAssignOrderStatus,
  getCompletedOrders,
  getCurrentOrder,
  getAvailableOrders,
  acceptAvailableOrder,
  getOrderSummary,
  assignOrder,
} from './hhd.order.controller';

import {
  getOrderItems,
  scanItem,
  getSubstitutes,
  markItemNotFound,
  unscanItem,
  updateItem,
} from './hhd.item.controller';

import { scanBag, updateBag, getBag } from './hhd.bag.controller';
import { scanRack, getRack, getAvailableRacks } from './hhd.rack.controller';
import { uploadPhoto, getPhoto, verifyPhoto } from './hhd.photo.controller';
import {
  getProfile,
  updateProfile,
  getContract,
  getEmployment,
  getLinkedPickerProfile,
  postHeartbeat,
} from './hhd.user.controller';
import { getDashboard } from './hhd.dashboard.controller';
import { linkPickerUserToHhd } from './hhd.admin.controller';
import { getCurrentDevice } from './hhd.devices.controller';
import {
  createScannedItem,
  getScannedItems,
  getScannedItem,
} from './hhd.scanneditem.controller';
import { reportIssue } from './hhd.pick.controller';
import { listTasks, updateTask } from './hhd.task.controller';

// ─── Multer setup for photo uploads ──────────────────────────────────────────

const uploadDir = process.env.UPLOAD_DIR || 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `hhd-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Optional multipart — allow JSON body without a file
const optionalPhotoUpload = upload.single('photo');

const router = Router();

// ── Auth routes (/auth) ───────────────────────────────────────────────────────
const authRouter = Router();
authRouter.post('/send-otp', validate(sendOtpBodySchema), sendOTP);
authRouter.post('/resend-otp', validate(sendOtpBodySchema), resendOTP);
authRouter.post('/verify-otp', validate(verifyOtpBodySchema), verifyOTPHandler);
authRouter.post('/refresh', validate(refreshBodySchema), refreshSession);
authRouter.get('/me', protect, getMe);
authRouter.post('/logout', protect, logout);

// ── Order routes (/orders) ────────────────────────────────────────────────────
const orderRouter = Router();
orderRouter.use(protect);
orderRouter.route('/').get(getOrders).post(createOrder);
orderRouter.get('/current', getCurrentOrder);
orderRouter.get('/available', getAvailableOrders);
orderRouter.get('/completed', getCompletedOrders);
orderRouter.get(
  '/status/:status',
  validate(orderStatusParamSchema, 'params'),
  validate(paginationQuerySchema, 'query'),
  getOrdersByStatus,
);
orderRouter.get('/assignorders/status/:status', getAssignOrdersByStatus);
orderRouter.put(
  '/assignorders/:orderId/status',
  validate(assignOrderStatusBodySchema),
  updateAssignOrderStatus,
);
orderRouter.get('/:orderId/summary', getOrderSummary);
orderRouter.get('/:orderId', getOrder);
orderRouter.put('/:orderId/accept', acceptAvailableOrder);
orderRouter.put(
  '/:orderId/status',
  validate(updateOrderStatusBodySchema),
  updateOrderStatus,
);
orderRouter.put(
  '/:orderId/assign',
  authorize(USER_ROLE.SUPERVISOR, USER_ROLE.ADMIN),
  validate(assignOrderBodySchema),
  assignOrder,
);

// ── Item routes (/items) ──────────────────────────────────────────────────────
const itemRouter = Router();
itemRouter.use(protect);
itemRouter.get('/order/:orderId', getOrderItems);
itemRouter.get('/substitutes', validate(substitutesQuerySchema, 'query'), getSubstitutes);
itemRouter.post('/scan', validate(scanItemBodySchema), scanItem);
itemRouter.put('/:itemId/not-found', validate(markNotFoundBodySchema), markItemNotFound);
itemRouter.put('/:itemId/unscan', unscanItem);
itemRouter.put('/:itemId', updateItem);

// ── Bag routes (/bags) ────────────────────────────────────────────────────────
const bagRouter = Router();
bagRouter.use(protect);
bagRouter.post('/scan', validate(scanBagBodySchema), scanBag);
bagRouter.route('/:bagId').get(getBag).put(updateBag);

// ── Rack routes (/racks) ──────────────────────────────────────────────────────
const rackRouter = Router();
rackRouter.use(protect);
rackRouter.post('/scan', validate(scanRackBodySchema), scanRack);
rackRouter.get('/available', getAvailableRacks);
rackRouter.get('/:rackCode', getRack);

// ── Photo routes (/photos) ────────────────────────────────────────────────────
const photoRouter = Router();
photoRouter.use(protect);
photoRouter.post('/', (req, res, next) => {
  optionalPhotoUpload(req, res, (err) => {
    if (err) return next(err);
    return uploadPhoto(req, res, next);
  });
});
photoRouter.get('/order/:orderId/bag/:bagId', getPhoto);
photoRouter.put('/:photoId/verify', verifyPhoto);

// ── User routes (/users) ──────────────────────────────────────────────────────
const userRouter = Router();
userRouter.use(protect);
userRouter.route('/profile').get(getProfile).put(updateProfile);
userRouter.get('/contract', getContract);
userRouter.get('/employment', getEmployment);
userRouter.get('/linked-picker-profile', getLinkedPickerProfile);
userRouter.post('/heartbeat', validate(heartbeatBodySchema), postHeartbeat);

// ── Dashboard routes (/dashboard) ─────────────────────────────────────────────
const dashboardRouter = Router();
dashboardRouter.use(protect);
dashboardRouter.get('/', getDashboard);

// ── Admin routes (/admin) ─────────────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(protect);
adminRouter.use(authorize(USER_ROLE.ADMIN, USER_ROLE.SUPERVISOR));
adminRouter.put('/picker-users/:pickerUserId/link', authorize(USER_ROLE.ADMIN), linkPickerUserToHhd);
adminRouter.put(
  '/orders/:orderId/assign',
  validate(assignOrderBodySchema),
  assignOrder,
);

// ── Device routes (/devices) ──────────────────────────────────────────────────
const deviceRouter = Router();
deviceRouter.use(protect);
deviceRouter.get('/current', getCurrentDevice);

// ── Scanned item routes (/scanned-items) ──────────────────────────────────────
const scannedItemRouter = Router();
scannedItemRouter.use(protect);
scannedItemRouter
  .route('/')
  .get(getScannedItems)
  .post(validate(scannedItemBodySchema), createScannedItem);
scannedItemRouter.get('/:id', getScannedItem);

// ── Pick routes (/pick) ───────────────────────────────────────────────────────
const pickRouter = Router();
pickRouter.post('/report-issue', protect, reportIssue);

// ── Task routes (/tasks) ──────────────────────────────────────────────────────
const taskRouter = Router();
taskRouter.use(protect);
taskRouter.get('/', validate(paginationQuerySchema, 'query'), listTasks);
taskRouter.put('/:taskId', validate(updateTaskBodySchema), updateTask);

// ─── Mount all sub-routers ────────────────────────────────────────────────────
router.use('/auth', authRouter);
router.use('/orders', orderRouter);
router.use('/items', itemRouter);
router.use('/bags', bagRouter);
router.use('/racks', rackRouter);
router.use('/photos', photoRouter);
router.use('/users', userRouter);
router.use('/dashboard', dashboardRouter);
router.use('/admin', adminRouter);
router.use('/devices', deviceRouter);
router.use('/scanned-items', scannedItemRouter);
router.use('/pick', pickRouter);
router.use('/tasks', taskRouter);

export default router;
