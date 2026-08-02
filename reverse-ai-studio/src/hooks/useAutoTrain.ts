import { useState, useEffect, useCallback } from 'react'

const AUTO_TRAIN_ENABLED_KEY      = 'auto_train_enabled'
const AUTO_TRAIN_THRESHOLD_KEY    = 'auto_train_threshold'
const AUTO_TRAIN_COUNT_KEY        = 'auto_train_approved_count'
const AUTO_TRAIN_NOTIFIED_KEY     = 'auto_train_notified'
const AUTO_TRAIN_LAST_TRAINED_KEY = 'auto_train_last_trained_at'

function readBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key)
  if (v === null) return fallback
  return v === 'true'
}

function readNum(key: string, fallback: number): number {
  const v = localStorage.getItem(key)
  if (v === null) return fallback
  const n = parseInt(v, 10)
  return isNaN(n) ? fallback : n
}

export function useAutoTrain() {
  const [enabled, setEnabledState]         = useState<boolean>(() => readBool(AUTO_TRAIN_ENABLED_KEY, false))
  const [threshold, setThresholdState]     = useState<number>(() => readNum(AUTO_TRAIN_THRESHOLD_KEY, 20))
  const [count, setCountState]             = useState<number>(() => readNum(AUTO_TRAIN_COUNT_KEY, 0))
  const [notified, setNotifiedState]       = useState<boolean>(() => readBool(AUTO_TRAIN_NOTIFIED_KEY, false))
  const [lastTrainedAt, setLastTrainedState] = useState<string>(() => localStorage.getItem(AUTO_TRAIN_LAST_TRAINED_KEY) ?? '')

  // Sync state from localStorage when another tab writes (storage event)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === AUTO_TRAIN_ENABLED_KEY)       setEnabledState(readBool(AUTO_TRAIN_ENABLED_KEY, false))
      if (e.key === AUTO_TRAIN_THRESHOLD_KEY)   setThresholdState(readNum(AUTO_TRAIN_THRESHOLD_KEY, 20))
      if (e.key === AUTO_TRAIN_COUNT_KEY)       setCountState(readNum(AUTO_TRAIN_COUNT_KEY, 0))
      if (e.key === AUTO_TRAIN_NOTIFIED_KEY)    setNotifiedState(readBool(AUTO_TRAIN_NOTIFIED_KEY, false))
      if (e.key === AUTO_TRAIN_LAST_TRAINED_KEY) setLastTrainedState(localStorage.getItem(AUTO_TRAIN_LAST_TRAINED_KEY) ?? '')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(AUTO_TRAIN_ENABLED_KEY, String(v))
    setEnabledState(v)
  }, [])

  const setThreshold = useCallback((v: number) => {
    localStorage.setItem(AUTO_TRAIN_THRESHOLD_KEY, String(v))
    setThresholdState(v)
  }, [])

  const incrementCount = useCallback(() => {
    setCountState(prev => {
      const next = prev + 1
      localStorage.setItem(AUTO_TRAIN_COUNT_KEY, String(next))

      const thr = readNum(AUTO_TRAIN_THRESHOLD_KEY, 20)
      if (next >= thr) {
        // Mark notified
        localStorage.setItem(AUTO_TRAIN_NOTIFIED_KEY, 'true')
        setNotifiedState(true)

        // If full-auto is enabled, fire the trigger event
        const isEnabled = readBool(AUTO_TRAIN_ENABLED_KEY, false)
        if (isEnabled) {
          window.dispatchEvent(new CustomEvent('auto-train-trigger'))
        }
      }

      return next
    })
  }, [])

  const resetCount = useCallback(() => {
    localStorage.setItem(AUTO_TRAIN_COUNT_KEY, '0')
    localStorage.setItem(AUTO_TRAIN_NOTIFIED_KEY, 'false')
    setCountState(0)
    setNotifiedState(false)
  }, [])

  const setLastTrainedAt = useCallback((iso: string) => {
    localStorage.setItem(AUTO_TRAIN_LAST_TRAINED_KEY, iso)
    setLastTrainedState(iso)
  }, [])

  // Override count from DB (called by MiniAITrainer after querying Supabase)
  const setDbCount = useCallback((n: number) => {
    localStorage.setItem(AUTO_TRAIN_COUNT_KEY, String(n))
    setCountState(n)
    const thr = readNum(AUTO_TRAIN_THRESHOLD_KEY, 20)
    if (n >= thr) {
      localStorage.setItem(AUTO_TRAIN_NOTIFIED_KEY, 'true')
      setNotifiedState(true)
      const isEnabled = readBool(AUTO_TRAIN_ENABLED_KEY, false)
      if (isEnabled) {
        window.dispatchEvent(new CustomEvent('auto-train-trigger'))
      }
    }
  }, [])

  const isReady = count >= threshold

  return {
    enabled,
    setEnabled,
    threshold,
    setThreshold,
    count,
    notified,
    isReady,
    lastTrainedAt,
    setLastTrainedAt,
    setDbCount,
    incrementCount,
    resetCount,
  }
}
