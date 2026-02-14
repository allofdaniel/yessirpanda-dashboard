import { NextRequest } from 'next/server';
import { getServerClient } from '@/lib/supabase';

// GET /api/relearn?email=xxx&day=N&word=xxx — 메일에서 단어별 "재학습" 클릭
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const word = request.nextUrl.searchParams.get('word');
  const meaning = request.nextUrl.searchParams.get('meaning') || '';

  if (!email || !word) {
    return new Response(closePage('잘못된 접근입니다.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 400,
    });
  }

  try {
    const supabase = getServerClient();

    // Upsert wrong word
    const { data: existing } = await supabase
      .from('wrong_words')
      .select('wrong_count')
      .eq('email', email)
      .eq('word', word)
      .single();

    const count = existing?.wrong_count || 0;

    await supabase.from('wrong_words').upsert(
      {
        email,
        word,
        meaning,
        wrong_count: count + 1,
        last_wrong: new Date().toISOString(),
        mastered: false,
      },
      { onConflict: 'email,word' }
    );

    return new Response(closePage(`"${word}" 재학습 등록 완료`, true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response(closePage('오류가 발생했습니다.', false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 500,
    });
  }
}

function closePage(message: string, success: boolean) {
  const color = success ? '#10b981' : '#f87171';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>옛설판다</title></head>
<body style="margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;">
<div style="text-align:center;padding:24px;">
<img src="/2.png" alt="옛설판다" width="48" height="48" style="margin-bottom:12px;">
<p style="color:${color};font-size:16px;font-weight:700;margin:0 0 8px;">${message}</p>
<p style="color:#71717a;font-size:12px;margin:0;">잠시 후 자동으로 닫힙니다</p>
</div>
<script>setTimeout(function(){window.close();},1500);</script>
</body></html>`;
}
