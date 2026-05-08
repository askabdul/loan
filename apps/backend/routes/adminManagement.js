const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Admin, Role } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { requireMenuAccess, requireActionPermission } = require('../middleware/roleAuth');

const router = express.Router();
router.use(adminAuth);

const adminInclude = [{ model: Role, as: 'Role', attributes: ['id', 'name', 'displayName', 'permissions', 'hierarchy'] }];

// GET /api/admin-management/admins
router.get('/admins', requireMenuAccess('user-management'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, status } = req.query;
    const where = {};

    if (search) where[Op.or] = [
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phoneNumber: { [Op.iLike]: `%${search}%` } },
    ];
    if (role) where.roleId = role;
    if (status) where.isActive = status === 'active';

    const { count, rows: admins } = await Admin.findAndCountAll({
      where, include: adminInclude,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ success: true, data: { admins, pagination: { current: parseInt(page), pages: Math.ceil(count / parseInt(limit)), total: count } } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/admin-management/admins
router.post('/admins', requireActionPermission('create_user'), [
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('email').isEmail(),
  body('phoneNumber').notEmpty(),
  body('password').isLength({ min: 6 }),
  body('role').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { firstName, lastName, email, phoneNumber, password, role, isActive = true } = req.body;

    const existingAdmin = await Admin.findOne({ where: { email } });
    if (existingAdmin) return res.status(400).json({ success: false, message: 'Admin with this email already exists' });

    const roleDoc = await Role.findByPk(role);
    if (!roleDoc) return res.status(400).json({ success: false, message: 'Invalid role specified' });

    // Hash password directly (beforeCreate hook also hashes, so pass raw)
    const admin = await Admin.create({ firstName, lastName, email, phoneNumber, password, roleId: role, isActive, createdById: req.admin.id });
    const full = await Admin.findByPk(admin.id, { include: adminInclude });
    res.status(201).json({ success: true, message: 'Admin created successfully', data: full });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/admin-management/admins/:id
router.get('/admins/:id', requireMenuAccess('user-management'), async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.params.id, { include: adminInclude });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.json({ success: true, data: admin });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/admin-management/admins/:id
router.put('/admins/:id', requireActionPermission('edit_user'), [
  body('firstName').optional().notEmpty(),
  body('lastName').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('phoneNumber').optional().notEmpty(),
  body('employeeNumber').optional().matches(/^\d{6}$/),
  body('dateJoined').optional().isISO8601(),
  body('dateOfExpiry').optional().isISO8601(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { firstName, lastName, email, phoneNumber, role, isActive, designation, employeeNumber, dateJoined, dateOfExpiry } = req.body;

    if (email && email !== admin.email) {
      const dup = await Admin.findOne({ where: { email } });
      if (dup) return res.status(400).json({ success: false, message: 'Admin with this email already exists' });
    }
    if (employeeNumber && employeeNumber !== admin.employeeNumber) {
      const dup = await Admin.findOne({ where: { employeeNumber } });
      if (dup) return res.status(400).json({ success: false, message: 'Admin with this employee number already exists' });
    }
    if (role && role !== admin.roleId) {
      const roleDoc = await Role.findByPk(role);
      if (!roleDoc) return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email) updates.email = email;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (designation) updates.designation = designation;
    if (employeeNumber) updates.employeeNumber = employeeNumber;
    if (dateJoined) updates.dateJoined = new Date(dateJoined);
    if (dateOfExpiry) updates.dateOfExpiry = new Date(dateOfExpiry);
    if (role) updates.roleId = role;
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    updates.updatedById = req.admin.id;

    await admin.update(updates);
    const full = await Admin.findByPk(admin.id, { include: adminInclude });
    res.json({ success: true, message: 'Admin updated successfully', data: full });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/admin-management/admins/:id/password
router.put('/admins/:id/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const admin = await Admin.scope('withPassword').findByPk(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const isOwnPassword = req.admin.id === req.params.id;
    if (!isOwnPassword) {
      const hasPermission = req.admin.getEffectivePermissions?.()?.actions?.reset_password;
      if (!hasPermission) return res.status(403).json({ success: false, message: 'You can only change your own password' });
    }

    const isValid = await bcrypt.compare(req.body.currentPassword, admin.password);
    if (!isValid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    await admin.update({ password: req.body.newPassword });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/admin-management/admins/:id
router.delete('/admins/:id', requireActionPermission('delete_user'), async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    if (req.admin.id === req.params.id) return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    await admin.update({ isActive: false });
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/admin-management/roles
router.get('/roles', requireMenuAccess('user-management'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const where = {};
    if (search) where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { displayName: { [Op.iLike]: `%${search}%` } }];
    if (status) where.isActive = status === 'active';

    const { count, rows: roles } = await Role.findAndCountAll({ where, order: [['hierarchy', 'ASC']], limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) });
    res.json({ success: true, data: roles, pagination: { current: parseInt(page), total: Math.ceil(count / parseInt(limit)), count } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/admin-management/roles/stats
router.get('/roles/stats', requireMenuAccess('user-management'), async (req, res) => {
  try {
    const [total, active, inactive] = await Promise.all([Role.count(), Role.count({ where: { isActive: true } }), Role.count({ where: { isActive: false } })]);
    res.json({ success: true, data: { total, active, inactive } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/admin-management/roles/:id
router.get('/roles/:id', requireMenuAccess('user-management'), async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, data: role });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/admin-management/roles
router.post('/roles', requireActionPermission('create_role'), [
  body('name').notEmpty(),
  body('displayName').notEmpty(),
  body('hierarchy').isInt({ min: 1 }),
  body('permissions').isObject(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, displayName, description, hierarchy, permissions } = req.body;
    const existingName = await Role.findOne({ where: { name } });
    if (existingName) return res.status(400).json({ success: false, message: 'Role name already exists' });
    const existingHierarchy = await Role.findOne({ where: { hierarchy } });
    if (existingHierarchy) return res.status(400).json({ success: false, message: 'Hierarchy level already exists' });

    const role = await Role.create({ name, displayName, description, hierarchy, permissions });
    res.status(201).json({ success: true, message: 'Role created successfully', data: role });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/admin-management/roles/:id
router.put('/roles/:id', requireActionPermission('edit_role'), [
  body('name').optional().notEmpty(),
  body('displayName').optional().notEmpty(),
  body('hierarchy').optional().isInt({ min: 1 }),
  body('permissions').optional().isObject(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    const { name, displayName, description, hierarchy, permissions } = req.body;
    if (name && name !== role.name) { const dup = await Role.findOne({ where: { name } }); if (dup) return res.status(400).json({ success: false, message: 'Role name already exists' }); }
    if (hierarchy && hierarchy !== role.hierarchy) { const dup = await Role.findOne({ where: { hierarchy } }); if (dup) return res.status(400).json({ success: false, message: 'Hierarchy level already exists' }); }

    const updates = {};
    if (name) updates.name = name;
    if (displayName) updates.displayName = displayName;
    if (description !== undefined) updates.description = description;
    if (hierarchy) updates.hierarchy = hierarchy;
    if (permissions) updates.permissions = permissions;

    await role.update(updates);
    res.json({ success: true, message: 'Role updated successfully', data: role });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/admin-management/roles/:id
router.delete('/roles/:id', requireActionPermission('delete_role'), async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    const adminCount = await Admin.count({ where: { roleId: role.id } });
    if (adminCount > 0) return res.status(400).json({ success: false, message: 'Cannot delete role that is assigned to admins' });
    await role.update({ isActive: false });
    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/admin-management/permissions
router.get('/permissions', async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.admin.id, { include: adminInclude });
    if (!admin || !admin.Role) return res.status(404).json({ success: false, message: 'Admin role not found' });

    const effectivePermissions = await admin.getEffectivePermissions();
    const permissions = { menus: effectivePermissions.menus || {}, subMenus: effectivePermissions.subMenus || {}, actions: effectivePermissions.actions || {}, dataAccess: effectivePermissions.dataAccess || {} };
    res.json({ success: true, data: { role: admin.Role.name, permissions } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
