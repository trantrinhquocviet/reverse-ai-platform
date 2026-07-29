import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url, fileName, warehouse, brand, userId } = req.body as {
    url: string
    fileName: string
    warehouse: string
    brand: string
    userId: string
  }

  if (!url || !fileName) return res.status(400).json({ error: 'url and fileName are required' })

  try {
    // 1. Download video from URL
    const videoRes = await fetch(url)
    if (!videoRes.ok) throw new Error(`Failed to fetch video: ${videoRes.status}`)
    const videoBuffer = await videoRes.arrayBuffer()

    // 2. Upload to Supabase Storage using service role key
    const storagePath = `${crypto.randomUUID()}/${fileName}`
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/videos/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': videoRes.headers.get('content-type') ?? 'video/mp4',
          'x-upsert': 'false',
        },
        body: videoBuffer,
      }
    )
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({})) as { message?: string }
      throw new Error(err.message ?? `Storage upload failed: ${uploadRes.status}`)
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`

    // 3. Insert DB record
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        name: fileName,
        warehouse,
        brand,
        file_path: publicUrl,
        status: 'pending',
        uploaded_by: userId || null,
      }),
    })
    if (!dbRes.ok) {
      const err = await dbRes.json().catch(() => ({})) as { message?: string }
      throw new Error(err.message ?? 'DB insert failed')
    }
    const [video] = await dbRes.json() as Array<{ id: string; name: string }>

    res.status(200).json({ id: video.id, name: video.name, file_path: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    res.status(500).json({ error: message })
  }
}
