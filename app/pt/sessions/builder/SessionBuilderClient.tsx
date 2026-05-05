'use client';

import { useRouter } from 'next/navigation';
import { Exercise, Session } from '@/types/database';
import SessionBuilder from '@/components/pt/SessionBuilder';

interface Props {
  ptId:            string;
  clientId:        string;
  exercises:       Exercise[];
  initialSession?: Session | null;
}

export default function SessionBuilderClient({
  ptId, clientId, exercises, initialSession,
}: Props) {
  const router = useRouter();

  function handleSaved(session: Session) {
    router.push(`/pt/clients?highlight=${session.client_id}`);
  }

  return (
    <SessionBuilder
      ptId={ptId}
      clientId={clientId}
      exercises={exercises}
      initialSession={initialSession ?? undefined}
      onSaved={handleSaved}
    />
  );
}
