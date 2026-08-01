import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'videos'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const url = new URL(req.url)
  const filename = url.searchParams.get('filename')
  if (!filename) {
    return new Response(JSON.stringify({ error: 'filename is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const videoId = crypto.randomUUID()
  const storagePath = `${videoId}/${filename}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Failed to create signed URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/${BUCKET}/${storagePath}`

  return new Response(
    JSON.stringify({
      upload_url: data.signedUrl,
      storage_path: storagePath,
      public_url: publicUrl,
    }),
    {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    },
  )
})
