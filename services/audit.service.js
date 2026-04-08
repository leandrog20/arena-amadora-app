/**
 * services/audit.service.js
 * Interface simples para registrar ações administrativas.
 */

'use strict';

const AuditRepository = require('../repositories/audit.repository');

const AuditService = {
  adminAction(req, action, { resourceType, resourceId, details } = {}) {
    if (!req?.user || req.user.role !== 'admin') return;

    AuditRepository.create({
      requestId: req.requestId,
      actorId: req.user.id,
      actorRole: req.user.role,
      action,
      resourceType,
      resourceId: resourceId != null ? String(resourceId) : null,
      details,
      ip: req.ip
    });
  }
};

module.exports = AuditService;
