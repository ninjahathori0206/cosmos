const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getPool } = require('../config/db');
const { authCustomerJwt } = require('../middleware/authCustomerJwt');
const { wallClockIso } = require('../lib/cosmosIst');
const {
  getMembershipDependentRelationshipsForApi,
  resolveMembershipForCustomer,
  getOwnActiveMembership,
  listDependents,
  addDependent: addMembershipDependent
} = require('../services/membershipDependentService');
const { getCustomerCoinBalance, getCustomerCoinLedger } = require('../lib/customerLoyaltyBalance');

const router = express.Router();
router.use(authCustomerJwt);

/* ── Prescription photo upload (multer) ─────────────────────── */
const RX_UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'prescriptions');
if (!fs.existsSync(RX_UPLOAD_DIR)) fs.mkdirSync(RX_UPLOAD_DIR, { recursive: true });

const rxStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RX_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    cb(null, `rx-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const rxUpload = multer({
  storage: rxStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
    if (ok.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error('Only image files are allowed for prescriptions.'));
  }
});

/* ── Helper: compute tier from points ───────────────────────── */
async function getTier(pool, points) {
  const r = await pool.request()
    .input('pts', points)
    .query(`
      SELECT TOP 1 tier_name, min_points, max_points, color_token
      FROM   dbo.loyalty_tiers
      WHERE  min_points <= @pts
        AND  (max_points = -1 OR max_points >= @pts)
      ORDER BY display_order DESC
    `);
  return r.recordset[0] || { tier_name: 'Silver', color_token: 'gray' };
}

/* ── Helper: order status label ─────────────────────────────── */
const STATUS_MAP = {
  ORDER_PLACED:                  'Order Placed',
  ADVANCE_PAID:                  'Order Placed',
  SENT_TO_LAB:                   'Order Placed',
  FRAME_PENDING_LENS_BACKORDER:  'Being Prepared',
  FRAME_RECEIVED_LENS_BACKORDER: 'Being Prepared',
  FRAME_AND_LENS_RECEIVED:       'Being Prepared',
  LAB_FITTING:                   'Being Prepared',
  QC_FAIL_LAB:                   'Being Prepared',
  QC_PASS:                       'Being Prepared',
  DISPATCHED_TO_STORE:           'Arriving at Store',
  RECEIVED_AT_STORE:             'Arriving at Store',
  STORE_QC_PASS:                 'Arriving at Store',
  STORE_QC_PARTIAL:              'Arriving at Store',
  QC_FAIL_STORE:                 'Arriving at Store',
  READY_FOR_DELIVERY:            'Ready for Pickup',
  DELIVERED:                     'Delivered',
  BALANCE_COLLECTED:             'Delivered',
  INVOICED:                      'Delivered',
  OPEN:                          'Order Placed',
  READY:                         'Ready for Pickup',
  CLOSED:                        'Delivered',
  CANCELLED:                     'Cancelled'
};

function mapStatus(labStatus, orderStatus) {
  if (labStatus && STATUS_MAP[labStatus]) return STATUS_MAP[labStatus];
  if (orderStatus && STATUS_MAP[orderStatus]) return STATUS_MAP[orderStatus];
  return 'In Progress';
}

/* ══════════════════════════════════════════════════════════════
   GET /api/customer/me — profile + membership + loyalty summary
══════════════════════════════════════════════════════════════ */
router.get('/me', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;

    const [profileR, membershipR] = await Promise.all([
      pool.request().input('cid', cid).query(`
        SELECT c.customer_id, c.full_name, c.phone, c.email, c.dob,
               c.lifestyle_prefs, c.home_store_id, c.created_at,
               s.store_name AS home_store_name, s.phone AS store_phone,
               s.address AS store_address
        FROM   dbo.pos_customers c
        LEFT JOIN dbo.stores s ON s.store_id = c.home_store_id
        WHERE  c.customer_id = @cid AND c.is_active = 1
      `),
      pool.request().input('cid', cid).query(`
        SELECT TOP 1 m.membership_id, m.plan_key, m.purchased_at, m.expires_at,
               m.price_paid, m.is_active,
               p.display_name AS plan_name
        FROM   dbo.customer_memberships m
        JOIN   dbo.membership_plans p ON p.plan_key = m.plan_key
        WHERE  m.customer_id = @cid AND m.is_active = 1
          AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
        ORDER BY m.expires_at DESC
      `),
    ]);

    const profile = profileR.recordset[0];
    if (!profile) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const membership = membershipR.recordset[0] || null;
    const coinBal = await getCustomerCoinBalance(pool, cid);
    const balance = coinBal.balance;
    const tier = await getTier(pool, balance);

    let prefs = null;
    try { prefs = profile.lifestyle_prefs ? JSON.parse(profile.lifestyle_prefs) : null; } catch {}

    return res.json({
      success: true,
      data: {
        customer_id:     profile.customer_id,
        full_name:       profile.full_name,
        phone:           profile.phone,
        email:           profile.email,
        dob:             profile.dob,
        lifestyle_prefs: prefs,
        home_store: profile.home_store_name
          ? { id: profile.home_store_id, name: profile.home_store_name, phone: profile.store_phone, address: profile.store_address }
          : null,
        member_since:    profile.created_at,
        membership,
        loyalty: {
          balance,
          tier: tier.tier_name,
          color_token: tier.color_token,
          coin_redemption_rate: coinBal.coin_redemption_rate,
          rupee_value: coinBal.rupee_value
        }
      }
    });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/customer/me — update dob + lifestyle_prefs
══════════════════════════════════════════════════════════════ */
router.patch('/me', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;
    const { dob, lifestyle_prefs } = req.body || {};

    const prefsStr = lifestyle_prefs ? JSON.stringify(lifestyle_prefs) : null;

    await pool.request()
      .input('cid', cid)
      .input('dob', dob || null)
      .input('prefs', prefsStr)
      .query(`
        UPDATE dbo.pos_customers
        SET    dob              = ISNULL(@dob, dob),
               lifestyle_prefs = ISNULL(@prefs, lifestyle_prefs),
               updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE  customer_id = @cid
      `);

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/customer/orders — order list
══════════════════════════════════════════════════════════════ */
router.get('/orders', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;

    const r = await pool.request().input('cid', cid).query(`
      SELECT o.order_id, o.order_no, o.order_kind, o.status AS order_status,
             o.total_amount, o.created_at,
             s.store_name,
             so.lab_workflow_status,
             (
               SELECT TOP 1 i.line_key
               FROM   dbo.pos_sub_orders so2
               JOIN   dbo.pos_order_items i ON i.sub_order_id = so2.sub_order_id
               WHERE  so2.order_id = o.order_id
             ) AS first_line_key
      FROM   dbo.pos_orders o
      JOIN   dbo.stores s ON s.store_id = o.store_id
      LEFT JOIN dbo.pos_sub_orders so ON so.order_id = o.order_id AND so.sort_order = 0
      WHERE  o.customer_id = @cid
      ORDER BY o.created_at DESC
    `);

    const orders = r.recordset.map(row => ({
      order_id:     row.order_id,
      order_no:     row.order_no,
      order_kind:   row.order_kind,
      status_label: mapStatus(row.lab_workflow_status, row.order_status),
      total_amount: row.total_amount,
      store_name:   row.store_name,
      created_at:   row.created_at,
      first_item:   row.first_line_key || null
    }));

    return res.json({ success: true, data: orders });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/customer/orders/:orderId — order detail + timeline
══════════════════════════════════════════════════════════════ */
router.get('/orders/:orderId', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;
    const orderId = parseInt(req.params.orderId, 10);
    if (!orderId) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const [orderR, itemsR, timelineR, pointsR] = await Promise.all([
      pool.request().input('cid', cid).input('oid', orderId).query(`
        SELECT o.order_id, o.order_no, o.order_kind, o.status AS order_status,
               o.subtotal_amount, o.gst_amount, o.total_amount, o.created_at,
               s.store_name, s.address AS store_address, s.phone AS store_phone,
               so.lab_workflow_status
        FROM   dbo.pos_orders o
        JOIN   dbo.stores s ON s.store_id = o.store_id
        LEFT JOIN dbo.pos_sub_orders so ON so.order_id = o.order_id AND so.sort_order = 0
        WHERE  o.order_id = @oid AND o.customer_id = @cid
      `),
      pool.request().input('oid', orderId).query(`
        SELECT i.order_item_id, i.product_type, i.line_key, i.qty,
               i.unit_price, i.line_total, i.lens_bundle
        FROM   dbo.pos_sub_orders so
        JOIN   dbo.pos_order_items i ON i.sub_order_id = so.sub_order_id
        WHERE  so.order_id = @oid
      `),
      pool.request().input('oid', orderId).query(`
        SELECT osl.to_status, osl.note, osl.created_at,
               u.full_name AS actor_name
        FROM   dbo.pos_order_status_log osl
        LEFT JOIN dbo.users u ON u.user_id = osl.actor_user_id
        WHERE  osl.order_id = @oid
        ORDER BY osl.created_at ASC
      `),
      pool.request().input('oid', orderId).input('cid', cid).query(`
        SELECT SUM(points_delta) AS earned
        FROM   dbo.pos_points_ledger
        WHERE  order_id = @oid AND customer_id = @cid AND points_delta > 0
      `)
    ]);

    const order = orderR.recordset[0];
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    return res.json({
      success: true,
      data: {
        ...order,
        status_label: mapStatus(order.lab_workflow_status, order.order_status),
        items: itemsR.recordset,
        timeline: timelineR.recordset.map(t => ({
          status:       t.to_status,
          status_label: mapStatus(t.to_status, null),
          note:         t.note,
          actor:        t.actor_name,
          at:           t.created_at
        })),
        points_earned: (pointsR.recordset[0] && pointsR.recordset[0].earned) || 0
      }
    });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/customer/eye-tests — prescription history
══════════════════════════════════════════════════════════════ */
router.get('/eye-tests', async (req, res, next) => {
  try {
    const pool = await getPool();
    const r = await pool.request().input('cid', req.customerId).query(`
      SELECT et.test_id, et.tested_at, et.source,
             et.re_sph, et.re_cyl, et.re_axis, et.re_add, et.re_va,
             et.le_sph, et.le_cyl, et.le_axis, et.le_add, et.le_va,
             et.pd, et.lens_type, et.notes,
             s.store_name,
             u.full_name AS tested_by_name
      FROM   dbo.eye_tests et
      LEFT JOIN dbo.stores s ON s.store_id = et.store_id
      LEFT JOIN dbo.users  u ON u.user_id  = et.tested_by_user_id
      WHERE  et.customer_id = @cid
      ORDER BY et.tested_at DESC
    `);
    return res.json({ success: true, data: r.recordset });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/customer/eye-tests — self-enter prescription
   Supports: full optometric form, simplified (sph/cyl/pd only),
             or photo upload handled separately below
══════════════════════════════════════════════════════════════ */
router.post('/eye-tests', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;
    const {
      tested_at,
      re_sph, re_cyl, re_axis, re_add, re_va,
      le_sph, le_cyl, le_axis, le_add, le_va,
      pd, lens_type, notes
    } = req.body || {};

    if (!re_sph && !le_sph) {
      return res.status(400).json({ success: false, message: 'At least one eye\'s SPH is required.' });
    }

    const testedDate = tested_at || wallClockIso();

    const r = await pool.request()
      .input('cid',        cid)
      .input('tested_at',  testedDate)
      .input('re_sph',     re_sph   || null)
      .input('re_cyl',     re_cyl   || null)
      .input('re_axis',    re_axis  || null)
      .input('re_add',     re_add   || null)
      .input('re_va',      re_va    || null)
      .input('le_sph',     le_sph   || null)
      .input('le_cyl',     le_cyl   || null)
      .input('le_axis',    le_axis  || null)
      .input('le_add',     le_add   || null)
      .input('le_va',      le_va    || null)
      .input('pd',         pd       || null)
      .input('lens_type',  lens_type || null)
      .input('notes',      notes    || null)
      .query(`
        INSERT INTO dbo.eye_tests
          (customer_id, tested_at, source,
           re_sph, re_cyl, re_axis, re_add, re_va,
           le_sph, le_cyl, le_axis, le_add, le_va,
           pd, lens_type, notes)
        OUTPUT INSERTED.test_id
        VALUES
          (@cid, @tested_at, N'CUSTOMER_FORM',
           @re_sph, @re_cyl, @re_axis, @re_add, @re_va,
           @le_sph, @le_cyl, @le_axis, @le_add, @le_va,
           @pd, @lens_type, @notes)
      `);

    return res.status(201).json({ success: true, test_id: r.recordset[0].test_id });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/customer/eye-tests/photo — upload prescription photo
══════════════════════════════════════════════════════════════ */
router.post('/eye-tests/photo', rxUpload.single('rx_photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file received.' });
    }

    const pool = await getPool();
    const cid = req.customerId;
    const relativePath = `/uploads/prescriptions/${req.file.filename}`;

    const r = await pool.request()
      .input('cid', cid)
      .input('photo_path', relativePath)
      .query(`
        INSERT INTO dbo.eye_tests (customer_id, tested_at, source, rx_photo_path)
        OUTPUT INSERTED.test_id
        VALUES (
          @cid,
          DATEADD(MINUTE, 330, SYSUTCDATETIME()),
          N'CUSTOMER_PHOTO',
          @photo_path
        )
      `);

    return res.status(201).json({ success: true, test_id: r.recordset[0].test_id, photo_url: relativePath });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/customer/loyalty — full ledger + tier progress
══════════════════════════════════════════════════════════════ */
router.get('/loyalty', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;

    const [coinBal, ledger, tiersR] = await Promise.all([
      getCustomerCoinBalance(pool, cid),
      getCustomerCoinLedger(pool, cid, 20),
      pool.request().query('SELECT * FROM dbo.loyalty_tiers ORDER BY display_order ASC')
    ]);

    const balance = coinBal.balance;
    const tiers   = tiersR.recordset;
    const tier    = await getTier(pool, balance);
    const coinRedemptionRate = coinBal.coin_redemption_rate;
    const rupeeValue = coinBal.rupee_value;

    const nextTier = tiers.find(t => t.min_points > balance && t.tier_name !== tier.tier_name) || null;
    const ptsToNext = nextTier ? nextTier.min_points - balance : 0;

    return res.json({
      success: true,
      data: {
        balance,
        tier:       tier.tier_name,
        color_token: tier.color_token,
        next_tier:   nextTier ? nextTier.tier_name : null,
        pts_to_next: Math.max(0, ptsToNext),
        tiers,
        ledger,
        coin_redemption_rate: coinRedemptionRate,
        rupee_value: rupeeValue
      }
    });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/customer/membership — plan + benefits + dependents
══════════════════════════════════════════════════════════════ */
router.get('/membership', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;

    const [resolved, benefitsR] = await Promise.all([
      resolveMembershipForCustomer(pool, cid),
      pool.request().query(`
        SELECT b.benefit_id, b.plan_key, b.icon_emoji, b.title, b.description, b.sort_order
        FROM   dbo.membership_plan_benefits b
        WHERE  b.is_active = 1
        ORDER BY b.plan_key, b.sort_order
      `)
    ]);

    let membership = null;
    let dependents = [];
    let inherited_from = null;
    const can_add_dependents = resolved.source === 'own';

    if (resolved.source === 'own') {
      const own = await getOwnActiveMembership(pool, cid);
      membership = own;
      if (own) {
        dependents = await listDependents(pool, own.membership_id);
      }
    } else if (resolved.source === 'dependent' && resolved.primary) {
      const primaryMem = await getOwnActiveMembership(pool, resolved.primary.customer_id);
      inherited_from = {
        customer_id: resolved.primary.customer_id,
        full_name: resolved.primary.full_name,
        phone: resolved.primary.phone,
        plan_key: resolved.plan_key,
        relationship: resolved.relationship,
        relationship_label: resolved.relationship_label,
        plan_name: primaryMem?.plan_name || resolved.plan_key,
        expires_at: primaryMem?.expires_at || null
      };
      membership = primaryMem
        ? {
            membership_id: primaryMem.membership_id,
            plan_key: primaryMem.plan_key,
            plan_name: primaryMem.plan_name,
            purchased_at: primaryMem.purchased_at,
            expires_at: primaryMem.expires_at,
            price_paid: primaryMem.price_paid,
            max_dependents: primaryMem.max_dependents,
            inherited: true
          }
        : {
            plan_key: resolved.plan_key,
            plan_name: resolved.plan_key,
            inherited: true
          };
    }

    const planKey = membership?.plan_key || null;
    const benefits = benefitsR.recordset.filter((b) => !planKey || b.plan_key === planKey);

    return res.json({
      success: true,
      data: {
        membership,
        benefits,
        dependents,
        membership_source: resolved.source,
        inherited_from,
        can_add_dependents,
        relationship_options: getMembershipDependentRelationshipsForApi()
      }
    });
  } catch (err) {
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/customer/membership/add-dependent
   Adds a buddy to the primary membership.
   Returns an invite link they can share via WhatsApp.
══════════════════════════════════════════════════════════════ */
router.post('/membership/add-dependent', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;
    const { phone, relationship, full_name: fullName } = req.body || {};

    const result = await addMembershipDependent(pool, {
      primaryCustomerId: cid,
      phone,
      relationship,
      fullName,
      createdByUserId: null
    });

    const host = process.env.APP_BASE_URL || 'http://localhost:4000';
    const inviteLink = `${host}/go`;

    return res.status(201).json({
      success: true,
      invite_link: inviteLink,
      data: result,
      message: `Buddy added! Share this link with them so they can set up their account: ${inviteLink}`
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/customer/offers — active offers for this customer
══════════════════════════════════════════════════════════════ */
router.get('/offers', async (req, res, next) => {
  try {
    const pool = await getPool();
    const cid = req.customerId;

    const resolved = await resolveMembershipForCustomer(pool, cid);
    const memRow = resolved.capabilities || null;

    const now = wallClockIso();
    const r = await pool.request()
      .input('now', now)
      .query(`
        SELECT offer_id, title, description, icon_emoji, discount_type,
               discount_value, valid_from, valid_to,
               required_capability, cashback_rate, sort_order
        FROM   dbo.customer_offers
        WHERE  is_active = 1
          AND  valid_from <= @now
          AND  valid_to   >= @now
        ORDER BY sort_order ASC, offer_id DESC
      `);

    const offers = r.recordset.filter(o => {
      if (!o.required_capability) return true;
      if (!memRow) return false;
      return Boolean(memRow[o.required_capability]);
    });

    return res.json({ success: true, data: offers });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
