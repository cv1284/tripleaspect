'use client';

import { useState } from 'react';
import { ClientRow } from '@/types/database';
import ClientDirectory from '@/components/pt/ClientDirectory';
import ClientProfileDrawer from '@/components/pt/ClientProfileDrawer';

interface Props {
  clients: ClientRow[];
  ptId:    string;
}

export default function ClientsPageClient({ clients: initial, ptId }: Props) {
  const [clients,  setClients]  = useState<ClientRow[]>(initial);
  const [selected, setSelected] = useState<ClientRow | null>(null);

  function handleSaved(updated: ClientRow) {
    setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
  }

  return (
    <div className="min-h-screen bg-surface-0 p-6">
      <div className="max-w-6xl mx-auto">
        <ClientDirectory
          clients={clients}
          onSelectClient={setSelected}
        />
      </div>

      <ClientProfileDrawer
        client={selected}
        onClose={() => setSelected(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
