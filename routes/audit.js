/**
 * routes/audit.js
 * Consulta e exportacao de trilha de auditoria (admin).
 */

'use strict';

const router = require('express').Router();
const { requireAdmin } = require('../middlewares/auth.middleware');
const AuditRepository = require('../repositories/audit.repository');

function parseQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const filters = {
    action: req.query.action ? String(req.query.action) : undefined,
    actorId: req.query.actorId ? parseInt(req.query.actorId, 10) : undefined,
    resourceType: req.query.resourceType ? String(req.query.resourceType) : undefined,
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined
  };

  if (Number.isNaN(filters.actorId)) filters.actorId = undefined;
  return { page, limit, filters };
}

router.get('/', requireAdmin, (req, res) => {
  const { page, limit, filters } = parseQuery(req);
  const items = AuditRepository.list({ page, limit, filters });
  const total = AuditRepository.count(filters);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
});

router.get('/export.csv', requireAdmin, (req, res) => {
  const { filters } = parseQuery(req);
  const total = AuditRepository.count(filters);
  const items = AuditRepository.list({ page: 1, limit: Math.max(1, total), filters });

  const header = ['id', 'created_at', 'request_id', 'actor_id', 'actor_role', 'action', 'resource_type', 'resource_id', 'ip', 'details'];
  const esc = (v) => {
    const str = v == null ? '' : String(v).replace(/\"/g, '""');
    return `"${str}"`;
  };

  const lines = [header.join(',')];
  for (const row of items) {
    lines.push([
      esc(row.id),
      esc(row.created_at),
      esc(row.request_id),
      esc(row.actor_id),
      esc(row.actor_role),
      esc(row.action),
      esc(row.resource_type),
      esc(row.resource_id),
      esc(row.ip),
      esc(row.details)
    ].join(','));
  }

  const csv = lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
  res.send(csv);
});

module.exports = router;
