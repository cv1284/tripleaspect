import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import { ProgressPhoto } from '@/types/database';
import PhotosClient      from './PhotosClient';
import PortalNav         from '@/components/client/PortalNav';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function PhotosPage({ params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Only the client's own photos page — PTs access via the API
  if (user.id !== clientId) redirect('/pt/clients');

  const { data: photos } = await supabase
    .from('progress_photos')
    .select('id, public_url, notes, taken_at, created_at')
    .eq('client_id', clientId)
    .order('taken_at', { ascending: false });

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-20 bg-surface-0/90 backdrop-blur-md border-b border-surface-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-slate-300 font-semibold font-mono text-sm tracking-tight">brigid.pro</span>
          <span className="text-xs font-mono text-slate-600">Progress</span>
        </div>
      </header>
      <PhotosClient initialPhotos={(photos ?? []) as ProgressPhoto[]} />
      <PortalNav clientId={clientId} />
    </div>
  );
}
