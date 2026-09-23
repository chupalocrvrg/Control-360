import React from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import ArticlesTab from '../components/inventory/ArticlesTab';
import WarehousesTab from '../components/inventory/WarehousesTab';
import TransfersTab from '../components/inventory/TransfersTab';
import LoansReturnsTab from '../components/inventory/LoansReturnsTab';
import { Package, Home } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Inventory() {
  const location = useLocation();

  const navTabs = [
    { name: 'Catálogo de Artículos', path: '/inventory/articles', icon: Package },
    { name: 'Bodegas y Stock', path: '/inventory/warehouses', icon: Home },
  ];

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">Inventario</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Gestión de catálogo de artículos y bodegas de almacenamiento.</p>
        </div>

        {/* Pestañas internas limpias */}
        <div className="inline-flex p-1.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 overflow-x-auto self-start md:self-auto">
          {navTabs.map((tab) => {
            const isActive = location.pathname === tab.path || (tab.path === '/inventory/articles' && location.pathname === '/inventory');
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-neutral-200/60 dark:border-neutral-700/60"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-700/40"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-400")} />
                <span>{tab.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="articles" replace />} />
        <Route path="articles" element={<ArticlesTab />} />
        <Route path="warehouses" element={<WarehousesTab />} />
        <Route path="transfers" element={<TransfersTab />} />
        <Route path="loans-returns" element={<LoansReturnsTab />} />
      </Routes>
    </div>
  );
}
