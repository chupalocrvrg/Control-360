import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

export default function AdminPanel() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/settings?tab=admin&subtab=users" replace />} />
      <Route path="users" element={<Navigate to="/settings?tab=admin&subtab=users" replace />} />
      <Route path="migration" element={<Navigate to="/settings?tab=admin&subtab=migration" replace />} />
      <Route path="master-backup" element={<Navigate to="/settings?tab=admin&subtab=master_backup" replace />} />
      <Route path="versions" element={<Navigate to="/settings?tab=admin&subtab=versions" replace />} />
      <Route path="audit" element={<Navigate to="/settings?tab=admin&subtab=audit" replace />} />
      <Route path="trash" element={<Navigate to="/settings?tab=admin&subtab=trash" replace />} />
      <Route path="notifications" element={<Navigate to="/settings?tab=admin&subtab=notifications" replace />} />
      <Route path="*" element={<Navigate to="/settings?tab=admin" replace />} />
    </Routes>
  );
}
