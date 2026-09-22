import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { HHDPickIssue, HHDInventory, HHDItem, HHDTask, HHDUser } from './hhd.models';
import {
  PICK_ISSUE_TYPE,
  INVENTORY_STATUS,
  ITEM_STATUS,
  TASK_STATUS,
  TASK_PRIORITY,
  PICK_NEXT_ACTION,
  PickIssueType,
} from './hhd.constants';
import mongoose from 'mongoose';

/**
 * Map extended pick-issue outcomes onto valid ITEM_STATUS enum values.
 * SHORT → not_found, REASSIGNED → pending (keep location update for alternate bin).
 */
function toPersistedItemStatus(nextAction: string, hasAlternate: boolean): string {
  if (nextAction === PICK_NEXT_ACTION.ALTERNATE_BIN && hasAlternate) {
    return ITEM_STATUS.PENDING;
  }
  return ITEM_STATUS.NOT_FOUND;
}

/**
 * POST /pick/report-issue
 * Body: { orderId, sku, binId, issueType, deviceId, notes }
 */
export async function reportIssue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.hhdUser?.id;
    if (!userId) {
      return next(new AppError('User not authenticated', 401, 'AUTH_REQUIRED'));
    }

    const { orderId, sku, binId, issueType, deviceId, notes } = req.body as {
      orderId?: string;
      sku?: string;
      binId?: string;
      issueType?: string;
      deviceId?: string;
      notes?: string;
    };

    if (!orderId || !sku || !binId || !issueType) {
      return next(
        new AppError('Please provide orderId, sku, binId, and issueType', 400, 'VALIDATION_ERROR'),
      );
    }

    if (!Object.values(PICK_ISSUE_TYPE).includes(issueType as PickIssueType)) {
      return next(new AppError('Invalid issue type', 400, 'VALIDATION_ERROR'));
    }

    const orderItem = await HHDItem.findOne({ orderId, itemCode: sku });
    if (!orderItem) {
      return next(new AppError('Order item not found', 404, 'NOT_FOUND'));
    }

    const pickIssue = await HHDPickIssue.create({
      orderId,
      sku,
      binId,
      issueType: issueType as PickIssueType,
      reportedBy: userId,
      deviceId: deviceId ?? undefined,
      notes: notes ?? undefined,
    });

    let nextAction: string = PICK_NEXT_ACTION.SKIP_ITEM;
    let alternateBinId: string | null = null;

    switch (issueType as PickIssueType) {
      case PICK_ISSUE_TYPE.ITEM_DAMAGED: {
        await HHDInventory.updateOne(
          { sku, binId },
          { $set: { status: INVENTORY_STATUS.DAMAGED }, $inc: { quantity: -1 } },
          { upsert: false },
        );
        const alternateBin = await HHDInventory.findOne({
          sku,
          status: INVENTORY_STATUS.AVAILABLE,
          quantity: { $gt: 0 },
          binId: { $ne: binId },
        }).sort({ quantity: -1 });
        if (alternateBin) {
          nextAction = PICK_NEXT_ACTION.ALTERNATE_BIN;
          alternateBinId = alternateBin.binId;
        }
        break;
      }

      case PICK_ISSUE_TYPE.ITEM_MISSING: {
        await HHDInventory.updateOne(
          { sku, binId, quantity: { $gt: 0 } },
          { $inc: { quantity: -1 } },
          { upsert: false },
        );
        await HHDTask.create({
          title: `Bin Audit Required: ${binId}`,
          description: `Item ${sku} reported as missing in bin ${binId} for order ${orderId}`,
          userId,
          orderId,
          status: TASK_STATUS.PENDING,
          priority: TASK_PRIORITY.HIGH,
        });
        const alternateBin = await HHDInventory.findOne({
          sku,
          status: INVENTORY_STATUS.AVAILABLE,
          quantity: { $gt: 0 },
          binId: { $ne: binId },
        }).sort({ quantity: -1 });
        if (alternateBin) {
          nextAction = PICK_NEXT_ACTION.ALTERNATE_BIN;
          alternateBinId = alternateBin.binId;
        }
        break;
      }

      case PICK_ISSUE_TYPE.ITEM_EXPIRED: {
        await HHDInventory.updateOne(
          { sku, binId },
          { $set: { status: INVENTORY_STATUS.EXPIRED } },
          { upsert: false },
        );
        const freshBatch = await HHDInventory.findOne({
          sku,
          status: INVENTORY_STATUS.AVAILABLE,
          quantity: { $gt: 0 },
          $or: [{ expiryDate: { $gte: new Date() } }, { expiryDate: { $exists: false } }],
          binId: { $ne: binId },
        }).sort({ expiryDate: 1 });
        if (freshBatch) {
          nextAction = PICK_NEXT_ACTION.ALTERNATE_BIN;
          alternateBinId = freshBatch.binId;
        }
        break;
      }

      case PICK_ISSUE_TYPE.WRONG_ITEM: {
        await HHDTask.create({
          title: `Bin Correction Required: ${binId}`,
          description: `Wrong item found in bin ${binId} for order ${orderId}. Expected: ${sku}`,
          userId,
          orderId,
          status: TASK_STATUS.PENDING,
          priority: TASK_PRIORITY.URGENT,
        });
        const alternateBin = await HHDInventory.findOne({
          sku,
          status: INVENTORY_STATUS.AVAILABLE,
          quantity: { $gt: 0 },
          binId: { $ne: binId },
        }).sort({ quantity: -1 });
        if (alternateBin) {
          nextAction = PICK_NEXT_ACTION.ALTERNATE_BIN;
          alternateBinId = alternateBin.binId;
        }
        break;
      }
    }

    orderItem.status = toPersistedItemStatus(nextAction, Boolean(alternateBinId)) as typeof orderItem.status;
    if (alternateBinId) {
      orderItem.location = alternateBinId;
    }
    await orderItem.save();

    if (nextAction === PICK_NEXT_ACTION.SKIP_ITEM) {
      await HHDUser.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $inc: { 'accuracyStats.shortPicks': 1 } },
      ).catch(() => {});
    }

    const responseData: Record<string, unknown> = {
      pickIssueId: pickIssue._id,
      nextAction,
    };
    if (nextAction === PICK_NEXT_ACTION.ALTERNATE_BIN && alternateBinId) {
      responseData.binId = alternateBinId;
    }

    res.status(200).json(ResponseFormatter.success(responseData));
  } catch (error) {
    next(error);
  }
}
