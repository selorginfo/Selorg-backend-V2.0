import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { CustomerUser } from '../auth/auth.model';
import { AppError } from '../../utils/AppError';
import { creditWallet, getBalance } from '../wallet/wallet.service';

export async function createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, phoneNumber } = req.body as { name?: string; email?: string; phoneNumber?: string };
    if (!name?.trim()) throw AppError.badRequest('name is required');
    if (!email?.trim() && !phoneNumber?.trim()) throw AppError.badRequest('email or phoneNumber is required');

    const normalizedEmail = email?.trim().toLowerCase() || undefined;
    const normalizedPhone = phoneNumber?.replace(/\D/g, '').slice(-10) || undefined;

    if (normalizedEmail) {
      const existing = await CustomerUser.findOne({ email: normalizedEmail }).lean();
      if (existing) throw new AppError('A customer with this email already exists', 409, 'EMAIL_EXISTS');
    }
    if (normalizedPhone) {
      const existing = await CustomerUser.findOne({ phoneNumber: normalizedPhone }).lean();
      if (existing) throw new AppError('A customer with this phone number already exists', 409, 'PHONE_EXISTS');
    }

    const customer = await CustomerUser.create({
      name: name.trim(),
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      status: 'active',
      onboardingCompleted: false,
      phoneVerified: false,
    });

    const shaped = {
      id: String(customer._id),
      name: customer.name,
      phone: customer.phoneNumber ?? '',
      email: customer.email ?? '',
      status: { label: 'Active', tone: 'green' },
      orders: 0,
      totalSpend: '₹0',
      walletBalance: 0,
      lastOrder: '—',
      tickets: 0,
    };

    res.status(201).json({ success: true, data: shaped });
  } catch (error) {
    next(error);
  }
}

export async function listCustomers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customers = await CustomerUser.find({}).sort({ createdAt: -1 }).limit(200).lean();
    const ids = customers.map((c) => c._id);
    const { Order } = await import('../orders/order.model');
    const [orderAgg, wallets] = await Promise.all([
      Order.aggregate([
        { $match: { userId: { $in: ids } } },
        {
          $group: {
            _id: '$userId',
            orders: { $sum: 1 },
            totalSpend: { $sum: { $ifNull: ['$totalBill', 0] } },
            lastOrder: { $max: '$createdAt' },
          },
        },
      ]),
      Promise.all(
        customers.map(async (c) => {
          try {
            const w = await getBalance(String(c._id));
            return { id: String(c._id), balance: Number(w.balance ?? 0) };
          } catch {
            return { id: String(c._id), balance: 0 };
          }
        }),
      ),
    ]);
    const orderMap = new Map(orderAgg.map((o) => [String(o._id), o]));
    const walletMap = new Map(wallets.map((w) => [w.id, w.balance]));

    const shaped = customers.map((c) => {
      const id = String(c._id);
      const agg = orderMap.get(id);
      const spend = Number(agg?.totalSpend ?? 0);
      return {
        id,
        name: c.name,
        phone: c.phoneNumber ?? '',
        email: c.email ?? '',
        status: c.status === 'active' ? { label: 'Active', tone: 'green' } : { label: 'Blocked', tone: 'red' },
        orders: String(Number(agg?.orders ?? 0)),
        totalSpend: `₹${spend.toLocaleString('en-IN')}`,
        walletBalance: walletMap.get(id) ?? 0,
        lastOrder: agg?.lastOrder ? new Date(agg.lastOrder).toLocaleString('en-IN') : '—',
        tickets: '0',
      };
    });
    res.status(200).json({ success: true, data: shaped, total: shaped.length });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { Order } = await import('../orders/order.model');
    const { SupportTicket } = await import('../support/support-ticket.model');
    const [total, active, blocked, orders, tickets] = await Promise.all([
      CustomerUser.countDocuments(),
      CustomerUser.countDocuments({ status: 'active' }),
      CustomerUser.countDocuments({ status: { $ne: 'active' } }),
      Order.countDocuments(),
      SupportTicket.countDocuments(),
    ]);
    res.status(200).json({
      success: true,
      data: { total, active, blocked, orders, tickets },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid customer id');
    }
    const customer = await CustomerUser.findById(id).lean();
    if (!customer) {
      throw AppError.notFound('Customer', id);
    }
    res.status(200).json({
      success: true,
      data: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email ?? '',
        phone: customer.phoneNumber ?? '',
        status: customer.status,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const body = (req.body || {}) as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
    if (typeof body.email === 'string') update.email = body.email.trim().toLowerCase();
    if (typeof body.phoneNumber === 'string' || typeof body.phone === 'string') {
      update.phoneNumber = String(body.phoneNumber || body.phone).replace(/\D/g, '').slice(-10);
    }
    if (typeof body.status === 'string' && body.status.trim()) {
      const status = body.status.trim().toLowerCase();
      update.status = status === 'blocked' || status === 'inactive' || status === 'suspended' ? 'blocked' : 'active';
    }
    if (Object.keys(update).length === 0) throw AppError.badRequest('No updatable fields provided');
    const customer = await CustomerUser.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!customer) throw AppError.notFound('Customer', id);
    res.status(200).json({
      success: true,
      data: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email ?? '',
        phone: customer.phoneNumber ?? '',
        status: customer.status,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const { Order } = await import('../orders/order.model');
    const data = await Order.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean();
    res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerRefunds(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const { RefundRequest } = await import('../orders/refund-request.model');
    const data = await RefundRequest.find({ customerId: id }).sort({ createdAt: -1 }).limit(200).lean();
    res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const { SupportTicket } = await import('../support/support-ticket.model');
    const data = await SupportTicket.find({ customerId: id }).sort({ createdAt: -1 }).limit(200).lean();
    res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const customer = await CustomerUser.findById(id).select('_id status').lean();
    if (!customer) throw AppError.notFound('Customer', id);
    const { Order } = await import('../orders/order.model');
    const cancelled = await Order.countDocuments({ userId: id, status: 'cancelled' });
    const total = await Order.countDocuments({ userId: id });
    const score = total === 0 ? 0 : Math.min(100, Math.round((cancelled / total) * 100));
    res.status(200).json({
      success: true,
      data: {
        customerId: id,
        status: customer.status,
        orderCount: total,
        cancelledOrders: cancelled,
        riskScore: score,
        level: score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerId = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw AppError.badRequest('Invalid customer id');
    }
    const customer = await CustomerUser.findById(customerId).select('_id').lean();
    if (!customer) {
      throw AppError.notFound('Customer', customerId);
    }
    const wallet = await getBalance(customerId);
    res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
}

export async function creditCustomerWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const customerId = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw AppError.badRequest('Invalid customer id');
    }

    const amountRaw = (req.body as { amount?: unknown } | undefined)?.amount;
    const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw AppError.badRequest('amount must be a positive number');
    }

    const customer = await CustomerUser.findById(customerId).select('_id').lean();
    if (!customer) {
      throw AppError.notFound('Customer', customerId);
    }

    const result = await creditWallet(customerId, amount, {
      source: 'manual_credit',
      description: 'Admin wallet credit',
      referenceType: 'manual',
    });

    if ('error' in result) {
      throw AppError.badRequest(result.error);
    }

    res.status(200).json({
      success: true,
      data: {
        customerId,
        balance: result.balance,
        credited: result.credited,
      },
      message: 'Wallet credited',
    });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const { CustomerAddress } = await import('../addresses/addresses.model');
    const data = await CustomerAddress.find({ userId: id }).sort({ isDefault: -1, createdAt: -1 }).lean();
    res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const { PaymentMethod } = await import('../payments/payment-method.model');
    const data = await PaymentMethod.find({ userId: id }).lean();
    res.status(200).json({ success: true, data, total: data.length });
  } catch (error) {
    next(error);
  }
}

export async function getCustomerPasswordInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const customer = await CustomerUser.findById(id).select('passwordHash passwordLastChangedAt passwordLastChangedBy').lean();
    if (!customer) throw AppError.notFound('Customer', id);
    res.status(200).json({
      success: true,
      data: {
        hasPassword: Boolean(customer.passwordHash),
        lastChangedAt: customer.passwordLastChangedAt ?? null,
        lastChangedBy: customer.passwordLastChangedBy ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function resetCustomerPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const bcrypt = await import('bcryptjs');
    const temp = `Selorg#${Math.random().toString(36).slice(2, 10)}`;
    const hash = await bcrypt.hash(temp, 10);
    const customer = await CustomerUser.findByIdAndUpdate(
      id,
      { $set: { passwordHash: hash, passwordLastChangedAt: new Date(), passwordLastChangedBy: 'admin' } },
      { new: true },
    ).select('_id').lean();
    if (!customer) throw AppError.notFound('Customer', id);
    res.status(200).json({ success: true, data: { customerId: id, temporaryPassword: temp }, message: 'Password reset' });
  } catch (error) {
    next(error);
  }
}

export async function setCustomerPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid customer id');
    const password = String((req.body as { password?: string } | undefined)?.password || '').trim();
    if (password.length < 8) throw AppError.badRequest('password must be at least 8 characters');
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const customer = await CustomerUser.findByIdAndUpdate(
      id,
      { $set: { passwordHash: hash, passwordLastChangedAt: new Date(), passwordLastChangedBy: 'admin' } },
      { new: true },
    ).select('_id').lean();
    if (!customer) throw AppError.notFound('Customer', id);
    res.status(200).json({ success: true, data: { customerId: id }, message: 'Password set' });
  } catch (error) {
    next(error);
  }
}
