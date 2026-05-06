'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ClientRow, AgreementStatus, AgreementModel, SessionCategory } from '@/types/database';
import {
  STATUS_CONFIG, CATEGORY_CONFIG,
  daysUntilRenewal, isOnboardingComplete, getInitials, formatCurrency,
} from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────

interface Props {
  clients:        ClientRow[];
  onSelectClient: (client: ClientRow) => void;
  onAddClient:    () => void;
}

type SortKey = 'name' | 'status' | 'renewal' | 'sessions' | 'onboarding';
type SortDir = 'asc' | 'desc';

// ─── Sub-components ───────────────────────────────────────

function StatusBadge({ status }: { status: AgreementStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`status-badge ${cfg.color} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ModelBadge({ model }: { model: AgreementModel }) {
  const labels: Record<AgreementModel, string> = {
    subscription: 'SUB',
    fixed_block:  'BLOCK',
    hybrid:       'HYBRID',
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-mono text-slate-500 bg-surface-2 border border-surface-border">
      {labels[model]}
    </span>
  );
}

function OnboardingIndicator({ complete, score }: { complete: boolean; score: number }) {
  if (complete) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-mono text-emerald-400">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        3/3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-mono text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {score}/3
    </span>
  );
}

function RenewalCell({ renewalDate }: { renewalDate: string | null }) {
  const days = daysUntilRenewal(renewalDate);
  if (days === null) return <span className="text-slate-600 text-sm font-mono">—</span>;
  if (days < 0)  return <span className="text-red-400 text-sm font-mono">Expired</span>;
  if (days <= 7) return <span className="text-amber-400 text-sm font-mono animate-pulse">{days}d</span>;
  return <span className="text-slate-400 text-sm font-mono">{days}d</span>;
}

function Avatar({ name, size = 'md' }: { name: string | null; size?: 'sm' | 'md' }) {
  const initials = getInitials(name);
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${dim} rounded-full bg-surface-4 border border-surface-border flex items-center justify-center font-mono font-semibold text-slate-300 flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Sort/Filter Bar ──────────────────────────────────────

function FilterBar({
  search, setSearch,
  statusFilter, setStatusFilter,
}: {
  search: string; setSearch: (v: string) => void;
  statusFilter: AgreementStatus | 'all'; setStatusFilter: (v: AgreementStatus | 'all') => void;
}) {
  const statuses: (AgreementStatus | 'all')[] = ['all', 'active', 'attention', 'paused', 'inactive'];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm">⌕</span>
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-8 h-9"
        />
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1">
        {statuses.map(s => {
          const active = statusFilter === s;
          const cfg    = s === 'all' ? null : STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-2xs font-mono transition-colors ${
                active
                  ? s === 'all'
                    ? 'bg-slate-600 text-white'
                    : `${cfg!.color} ${cfg!.text} border border-current/20`
                  : 'text-slate-500 hover:text-slate-300 bg-surface-2 border border-surface-border'
              }`}
            >
              {s === 'all' ? 'ALL' : STATUS_CONFIG[s].label.toUpperCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

export default function ClientDirectory({ clients, onSelectClient, onAddClient }: Props) {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<AgreementStatus | 'all'>('all');
  const [sortKey,      setSortKey]      = useState<SortKey>('name');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    let rows = [...clients];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== 'all') {
      rows = rows.filter(c => c.agreement.status === statusFilter);
    }

    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':       cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '');          break;
        case 'status':     cmp = a.agreement.status.localeCompare(b.agreement.status);           break;
        case 'renewal':    cmp = (daysUntilRenewal(a.agreement.renewal_date) ?? 9999) - (daysUntilRenewal(b.agreement.renewal_date) ?? 9999); break;
        case 'sessions':   cmp = a.sessions_this_week - b.sessions_this_week;                    break;
        case 'onboarding': cmp = Number(isOnboardingComplete(a.agreement)) - Number(isOnboardingComplete(b.agreement)); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [clients, search, statusFilter, sortKey, sortDir]);

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`label flex items-center gap-1 hover:text-slate-400 transition-colors ${active ? 'text-slate-300' : ''}`}
      >
        {label}
        <span className="text-[10px]">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Client Directory</h1>
          <p className="text-sm text-slate-500 font-mono mt-0.5">{clients.length} clients · {filtered.length} shown</p>
        </div>
        <button onClick={onAddClient} className="btn-primary">
          <span>+</span> Add Client
        </button>
      </div>

      {/* Filters */}
      <FilterBar
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
      />

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-2.5 border-b border-surface-border">
          <SortButton k="name"       label="Client" />
          <SortButton k="status"     label="Status" />
          <span className="label">Model</span>
          <SortButton k="sessions"   label="Wk Sessions" />
          <SortButton k="renewal"    label="Renewal" />
          <SortButton k="onboarding" label="Docs" />
          <span className="label">Actions</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-600 font-mono text-sm">
            No clients match the current filters.
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {filtered.map(client => {
              const agreement  = client.agreement;
              const complete   = isOnboardingComplete(agreement);
              const score      = [agreement.parq_signed, agreement.waiver_signed, agreement.consent_signed].filter(Boolean).length;
              const price      = formatCurrency(agreement.manual_price_numeric, agreement.manual_currency);

              return (
                <div
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 hover:bg-surface-4 cursor-pointer transition-colors group"
                >
                  {/* Client */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={client.full_name} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {client.full_name ?? 'Unnamed'}
                      </p>
                      <p className="text-2xs font-mono text-slate-600 truncate">{client.email}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={agreement.status} />
                  </div>

                  {/* Model + Price */}
                  <div className="flex flex-col gap-1">
                    <ModelBadge model={agreement.agreement_model} />
                    <span className="text-2xs font-mono text-slate-600">{price}/mo</span>
                  </div>

                  {/* Sessions this week */}
                  <div className="text-sm font-mono text-slate-400">
                    {client.sessions_this_week}<span className="text-slate-600"> sess</span>
                  </div>

                  {/* Renewal */}
                  <RenewalCell renewalDate={agreement.renewal_date} />

                  {/* Onboarding */}
                  <OnboardingIndicator complete={complete} score={score} />

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/pt/sessions/builder?clientId=${client.id}`}
                      className="btn-ghost py-1 px-2 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      + Session
                    </Link>
                    <button
                      onClick={() => onSelectClient(client)}
                      className="btn-ghost py-1 px-2 text-xs"
                    >
                      Edit →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attention summary strip */}
      {clients.some(c => c.agreement.status === 'attention') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/8 border border-amber-500/20 text-amber-400 text-sm font-mono">
          <span className="text-base">⚠</span>
          {clients.filter(c => c.agreement.status === 'attention').length} client(s) require attention — review onboarding or billing status.
        </div>
      )}
    </div>
  );
}
