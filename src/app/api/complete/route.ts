import { NextRequest } from 'next/server';
import { getServerClient } from '@/lib/supabase';

// GET /api/complete?email=xxx&day=N — 메일에서 "학습 완료" 버튼 클릭 시 호출
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const dayParam = request.nextUrl.searchParams.get('day');

  if (!email || !dayParam) {
    return new Response(buildHtml('잘못된 접근입니다.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 400,
    });
  }

  const day = parseInt(dayParam);
  if (isNaN(day)) {
    return new Response(buildHtml('잘못된 접근입니다.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 400,
    });
  }

  try {
    const supabase = getServerClient();

    // Check if already completed
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('email', email)
      .eq('type', 'lunch')
      .eq('date', new Date().toISOString().slice(0, 10))
      .single();

    if (existing) {
      return new Response(buildHtml('이미 학습 완료 처리되었습니다!', true), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Record completion
    await supabase.from('attendance').upsert(
      {
        email,
        date: new Date().toISOString().slice(0, 10),
        type: 'lunch',
        completed: true,
      },
      { onConflict: 'email,date,type' }
    );

    return new Response(buildHtml(`Day ${day} 학습 완료! 수고하셨습니다 🎉`, true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response(buildHtml('오류가 발생했습니다. 다시 시도해주세요.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 500,
    });
  }
}

function buildHtml(message: string, success: boolean) {
  const color = success ? '#10b981' : '#f87171';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>옛설판다</title></head>
<body style="margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;">
<div style="text-align:center;padding:24px;">
<p style="color:${color};font-size:16px;font-weight:700;margin:0 0 8px;">🐼 ${message}</p>
<p style="color:#71717a;font-size:12px;margin:0;">잠시 후 자동으로 닫힙니다</p>
</div>
<script>setTimeout(function(){window.close();},1500);</script>
</body></html>`;
}
