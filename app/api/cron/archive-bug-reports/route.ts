import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { bugRefLabel, BugReport } from '@/types/database';

// Monthly Vercel Cron — archives resolved bug reports older than 90 days to Notion, then deletes them.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notionKey = process.env.NOTION_BUG_REPORTS_DB_ID
    ? process.env.NOTION_API_KEY
    : null;
  const dbId      = process.env.NOTION_BUG_REPORTS_DB_ID;

  if (!notionKey || !dbId) {
    return NextResponse.json({ skipped: true, reason: 'Notion not configured' });
  }

  const admin  = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { data: reports, error } = await admin
    .from('bug_reports')
    .select(`
      id, ref, url, page_title, notes, report_type, status,
      resolved_note, resolved_at, created_at,
      user:profiles ( full_name, email )
    `)
    .eq('status', 'resolved')
    .lt('resolved_at', cutoff.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reports?.length) return NextResponse.json({ archived: 0, failed: 0 });

  let archived = 0;
  const failedRefs: string[] = [];

  for (const report of reports as unknown as (BugReport & { user?: { full_name: string | null; email: string } })[]) {
    const label = bugRefLabel(report);
    try {
      const notionRes = await fetch('https://api.notion.com/v1/pages', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${notionKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            Name:          { title:   [{ text: { content: label } }] },
            Type:          { select:  { name: report.report_type === 'bug' ? 'Bug' : 'Feature' } },
            Status:        { select:  { name: 'Resolved' } },
            URL:           { url:     report.url },
            'Page Title':  { rich_text: [{ text: { content: report.page_title } }] },
            Notes:         { rich_text: [{ text: { content: report.notes ?? '' } }] },
            'User Name':   { rich_text: [{ text: { content: report.user?.full_name ?? '' } }] },
            'User Email':  { email:   report.user?.email ?? '' },
            'Resolved Note': { rich_text: [{ text: { content: report.resolved_note ?? '' } }] },
            'Created At':  { date: { start: report.created_at } },
            'Resolved At': { date: { start: report.resolved_at ?? report.created_at } },
          },
        }),
      });

      if (!notionRes.ok) throw new Error(`Notion ${notionRes.status}`);

      await admin.from('bug_reports').delete().eq('id', report.id);
      archived++;
    } catch (e) {
      console.error(`[archive-bug-reports] failed ${label}:`, e);
      failedRefs.push(label);
    }
  }

  return NextResponse.json({ archived, failed: failedRefs.length, failedRefs, cutoff: cutoff.toISOString() });
}
