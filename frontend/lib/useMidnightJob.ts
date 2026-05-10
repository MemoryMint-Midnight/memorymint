'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export type MidnightJobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface MidnightJobState {
  status: MidnightJobStatus | null
  result: Record<string, unknown> | null
  error: string | null
}

const POLL_MS = 8_000

/**
 * Polls GET /memorymint/v1/midnight/job/{jobId} every 8 seconds until the job
 * reaches 'done' or 'failed'. Stops automatically on completion or when jobId
 * is cleared (set to null). Reads auth token from sessionStorage on each poll
 * so a session refresh mid-job still works.
 */
export function useMidnightJob(apiBase: string, jobId: string | null): MidnightJobState {
  const [state, setState] = useState<MidnightJobState>({ status: null, result: null, error: null })
  const activeRef = useRef(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback(async () => {
    if (!jobId || !activeRef.current) return
    const token = sessionStorage.getItem('mmToken')
    if (!token) return

    try {
      const res  = await fetch(`${apiBase}/memorymint/v1/midnight/job/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) return

      setState({
        status: data.status,
        result: data.result  ?? null,
        error:  data.error   ?? null,
      })

      if (data.status === 'done' || data.status === 'failed') {
        activeRef.current = false
        return
      }
    } catch {
      // network hiccup — keep polling
    }

    if (activeRef.current) {
      timerRef.current = setTimeout(poll, POLL_MS)
    }
  }, [jobId, apiBase])

  useEffect(() => {
    if (!jobId) {
      setState({ status: null, result: null, error: null })
      return
    }

    activeRef.current = true
    setState({ status: 'queued', result: null, error: null })
    poll()

    return () => {
      activeRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [jobId, poll])

  return state
}
