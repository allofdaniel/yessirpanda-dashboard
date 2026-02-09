'use client'

import { useEffect, useState, useCallback } from 'react'
import { createAuthBrowserClient } from './supabase-auth'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TableName = 'subscribers' | 'subscriber_settings' | 'config' | 'quiz_results' | 'words'

interface UseRealtimeOptions<T> {
  table: TableName
  schema?: string
  filter?: string
  onInsert?: (payload: T) => void
  onUpdate?: (payload: T) => void
  onDelete?: (payload: T) => void
  enabled?: boolean
}

export function useRealtime<T extends Record<string, unknown>>({
  table,
  schema = 'public',
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions<T>) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimePostgresChangesPayload<T> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const supabase = createAuthBrowserClient()
    let channel: RealtimeChannel

    const setupChannel = () => {
      const channelConfig: {
        event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
        schema: string
        table: string
        filter?: string
      } = {
        event: '*',
        schema,
        table,
      }

      if (filter) {
        channelConfig.filter = filter
      }

      channel = supabase
        .channel(`realtime-${table}-${Date.now()}`)
        .on(
          'postgres_changes',
          channelConfig,
          (payload: RealtimePostgresChangesPayload<T>) => {
            setLastEvent(payload)

            const newRecord = payload.new as T
            const oldRecord = payload.old as T

            switch (payload.eventType) {
              case 'INSERT':
                onInsert?.(newRecord)
                break
              case 'UPDATE':
                onUpdate?.(newRecord)
                break
              case 'DELETE':
                onDelete?.(oldRecord)
                break
            }
          }
        )
        .subscribe((status) => {
          setIsConnected(status === 'SUBSCRIBED')
        })
    }

    setupChannel()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [table, schema, filter, onInsert, onUpdate, onDelete, enabled])

  return { isConnected, lastEvent }
}

// Hook for subscribing to config changes
export function useConfigRealtime(onConfigChange?: (config: Record<string, string>) => void) {
  const [config, setConfig] = useState<Record<string, string>>({})

  const handleUpdate = useCallback((payload: { key: string; value: string }) => {
    setConfig((prev) => ({ ...prev, [payload.key]: payload.value }))
    if (onConfigChange) {
      onConfigChange({ ...config, [payload.key]: payload.value })
    }
  }, [config, onConfigChange])

  const { isConnected } = useRealtime<{ key: string; value: string }>({
    table: 'config',
    onUpdate: handleUpdate,
    onInsert: handleUpdate,
  })

  return { config, isConnected }
}

// Hook for subscribing to subscriber status changes
export function useSubscriberRealtime(
  email: string,
  onStatusChange?: (status: string) => void
) {
  const [subscriber, setSubscriber] = useState<Record<string, unknown> | null>(null)

  const handleUpdate = useCallback((payload: Record<string, unknown>) => {
    setSubscriber(payload)
    if (onStatusChange && payload.status) {
      onStatusChange(payload.status as string)
    }
  }, [onStatusChange])

  const { isConnected } = useRealtime({
    table: 'subscribers',
    filter: `email=eq.${email}`,
    onUpdate: handleUpdate,
    enabled: !!email,
  })

  return { subscriber, isConnected }
}

// Hook for subscribing to quiz results (for leaderboard)
export function useQuizResultsRealtime(
  onNewResult?: (result: Record<string, unknown>) => void
) {
  const [latestResults, setLatestResults] = useState<Record<string, unknown>[]>([])

  const handleInsert = useCallback((payload: Record<string, unknown>) => {
    setLatestResults((prev) => [payload, ...prev].slice(0, 10))
    onNewResult?.(payload)
  }, [onNewResult])

  const { isConnected } = useRealtime({
    table: 'quiz_results',
    onInsert: handleInsert,
  })

  return { latestResults, isConnected }
}

// Presence hook for tracking online users (optional feature)
export function usePresence(roomId: string, userInfo: Record<string, unknown>) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, unknown>[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const supabase = createAuthBrowserClient()

    const channel = supabase.channel(`presence-${roomId}`, {
      config: {
        presence: {
          key: userInfo.id as string || 'anonymous',
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flat() as Record<string, unknown>[]
        setOnlineUsers(users)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers((prev) => [...prev, ...newPresences])
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers((prev) =>
          prev.filter(
            (user) => !leftPresences.some((left) => left.id === user.id)
          )
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userInfo)
          setIsConnected(true)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, userInfo])

  return { onlineUsers, isConnected }
}
