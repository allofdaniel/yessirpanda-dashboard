import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = getServerClient()

  // Get all stats in parallel
  const [wrongRes, masteredRes, attendanceRes, configRes] = await Promise.all([
    supabase.from('wrong_words').select('word, meaning, wrong_count, last_wrong, mastered').eq('email', email),
    supabase.from('wrong_words').select('id', { count: 'exact' }).eq('email', email).eq('mastered', true),
    supabase.from('attendance').select('date, type, completed').eq('email', email).order('date', { ascending: false }),
    supabase.from('config').select('key, value'),
  ])

  const wrongWords = wrongRes.data || []
  const masteredCount = masteredRes.count || 0
  const attendance = attendanceRes.data || []
  const config: Record<string, string> = {}
  configRes.data?.forEach((r: { key: string; value: string }) => { config[r.key] = r.value })

  // Calculate streak
  let streak = 0
  const today = new Date().toISOString().slice(0, 10)
  const dates = [...new Set(attendance.filter(a => a.completed).map(a => a.date))].sort().reverse()

  const checkDate = new Date(today)
  for (const d of dates) {
    const dateStr = checkDate.toISOString().slice(0, 10)
    if (d === dateStr) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (d < dateStr) {
      break
    }
  }

  // Today's schedule
  const todayAttendance = attendance.filter(a => a.date === today)
  const schedule = {
    morning: todayAttendance.some(a => a.type === 'morning' && a.completed),
    lunch: todayAttendance.some(a => a.type === 'lunch' && a.completed),
    evening: todayAttendance.some(a => a.type === 'evening' && a.completed),
  }

  // Recent wrong words (top 5, not mastered, sorted by wrong_count desc)
  const recentWrong = wrongWords
    .filter(w => !w.mastered)
    .sort((a, b) => b.wrong_count - a.wrong_count)
    .slice(0, 5)

  // Average words mastered per day (total mastered / total days studied)
  const uniqueDays = new Set(attendance.filter(a => a.completed).map(a => a.date)).size
  const avgPerDay = uniqueDays > 0 ? Math.round((masteredCount / uniqueDays) * 10) / 10 : 0

  return NextResponse.json({
    currentDay: parseInt(config.CurrentDay || '1'),
    totalDays: parseInt(config.TotalDays || '10'),
    wordsPerDay: parseInt(config.WordsPerDay || '10'),
    totalWrong: wrongWords.filter(w => !w.mastered).length,
    masteredCount,
    streak,
    schedule,
    recentWrong,
    avgPerDay,
    totalStudyDays: uniqueDays,
  })
}
