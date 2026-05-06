'use client';

import { useState } from 'react';
import { ClientRow } from '@/types/database';
import ClientDirectory from '@/components/pt/ClientDirectory';
import ClientProfileDrawer from '@/components/pt/ClientProfileDrawer';
import AddClientModal from '@/components/pt/AddClientModal';

interface Props {
  clients: ClientRow[];
  ptId:    string;
}

export default function ClientsPageClient({ clients: initial, ptId }: Props) {
  const [clients,       setClients]       = useState<ClientRow[]>(initial);
  const [selected,      setSelected]      = useState<ClientRow | null>(null);
  const [showAddModal,  setShowAddModal]  = useState(false);

  function handleSaved(updated: ClientRow) {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  function handleAdded(newClient: ClientRow) {
    setClients(prev => [newClient, ...prev]);
  }

  return (
    <div className="min-h-screen bg-surface-0 p-6">
      <div className="max-w-6xl mx-auto">
        <ClientDirectory
          clients={clients}
          onSelectClient={setSelected}
          onAddClient={() => setShowAddModal(true)}
        />
      </div>

      <ClientProfileDrawer
        client={selected}
        onClose={() => setSelected(null)}
        onSaved={handleSaved}
      />

      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}
