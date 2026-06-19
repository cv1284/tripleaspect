import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils';

export interface PersonalRecord {
  exercise_id:   string;
  exercise_name: string;
  category:      string;
  metric:        string;
  value:         number;
  unit:          string;
  achieved_at:   string;
  session_title: string;
}

// GET /api/portal/records?clientId=<uuid>
// Returns personal records (lifetime bests) for each exercise metric.
// Accessible by the client themselves or their PT.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  const clientId = req.nextUrl.searchParams.get('clientId') ?? user.id;
  if (!isValidUuid(clientId)) return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });

  if (clientId !== user.id) {
    if (profile?.role !== 'pt') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data: agreement } = await supabase
      .from('client_agreements').select('id')
      .eq('pt_id', user.id).eq('client_id', clientId).maybeSingle();
    if (!agreement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all completed session items for this client via a session join
  const { data: items, error } = await supabase
    .from('session_items')
    .select(`
      id,
      prescribed_metrics,
      exercise:exercises ( id, name, category ),
      session:sessions!inner ( id, title, scheduled_date, client_id, completed_at )
    `)
    .eq('session.client_id', clientId)
    .not('session.completed_at', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Extract numeric bests per exercise per metric
  const bests = new Map<string, PersonalRecord>();

  for (const item of items ?? []) {
    const ex      = item.exercise as unknown as { id: string; name: string; category: string } | null;
    const session = item.session as unknown as { title: string; scheduled_date: string | null; completed_at: string | null } | null;
    const metrics = item.prescribed_metrics as Record<string, unknown>;
    if (!ex || !session || !metrics) continue;

    const completedAt = session.completed_at ?? session.scheduled_date ?? '';

    // Only track numeric metrics that represent performance bests
    const tracked: { key: string; unit: string }[] = [
      { key: 'weight_kg',       unit: 'kg'  },
      { key: 'reps',            unit: 'reps'},
      { key: 'distance_km',     unit: 'km'  },
      { key: 'duration_minutes',unit: 'min' },
    ];

    for (const { key, unit } of tracked) {
      const raw = metrics[key];
      if (raw == null) continue;
      const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      if (!isFinite(num) || num <= 0) continue;

      const mapKey = `${ex.id}::${key}`;
      const existing = bests.get(mapKey);
      if (!existing || num > existing.value) {
        bests.set(mapKey, {
          exercise_id:   ex.id,
          exercise_name: ex.name,
          category:      ex.category,
          metric:        key,
          value:         num,
          unit,
          achieved_at:   completedAt,
          session_title: session.title,
        });
      }
    }
  }

  const records = Array.from(bests.values()).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.exercise_name.localeCompare(b.exercise_name);
  });

  return NextResponse.json(records);
}
