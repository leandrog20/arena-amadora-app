/**
 * repositories/audit.repository.js
 * Persistência de trilha de auditoria.
 */

'use strict';

const db = require('../db/database');

function buildWhere(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.action) {
    clauses.push('action = ?');
    params.push(filters.action);
  }
  if (filters.actorId) {
    clauses.push('actor_id = ?');
    params.push(filters.actorId);
  }
  if (filters.resourceType) {
    clauses.push('resource_type = ?');
    params.push(filters.resourceType);
  }
  if (filters.from) {
    clauses.push('datetime(created_at) >= datetime(?)');
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push('datetime(created_at) <= datetime(?)');
    params.push(filters.to);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

const AuditRepository = {
  create({ requestId, actorId, actorRole, action, resourceType, resourceId, details, ip }) {
    return db.prepare(`
      INSERT INTO audit_logs (
        request_id, actor_id, actor_role, action, resource_type, resource_id, details, ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId || null,
      actorId,
      actorRole,
      action,
      resourceType || null,
      resourceId || null,
      details ? JSON.stringify(details) : null,
      ip || null
    );
  },

  list({ page = 1, limit = 20, filters = {} } = {}) {
    const offset = (page - 1) * limit;
    const { where, params } = buildWhere(filters);

    return db.prepare(`
      SELECT id, request_id, actor_id, actor_role, action, resource_type, resource_id, details, ip, created_at
      FROM audit_logs
      ${where}
      ORDER BY datetime(created_at) DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
  },

  count(filters = {}) {
    const { where, params } = buildWhere(filters);
    return db.prepare(`
      SELECT COUNT(*) AS total
      FROM audit_logs
      ${where}
    `).get(...params).total;
  }
};

module.exports = AuditRepository;
