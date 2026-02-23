import { getSupabaseClient, getEnvVar } from '../_shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const { email, preview_secret } = await req.json();

    if (!email || !preview_secret) {
      return new Response(
        JSON.stringify({ error: 'Missing email or preview_secret' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const expectedSecret = getEnvVar('PREVIEW_SECRET');
    if (preview_secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid preview secret' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (error) {
      console.error('generateLink error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to generate login link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // hashed_token is available directly on data.properties
    // action_link uses a fragment (#) so URL.searchParams won't find it
    const tokenHash = data.properties?.hashed_token;

    if (!tokenHash) {
      console.error('generateLink response missing hashed_token:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'No token_hash in generated link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ token_hash: tokenHash, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('preview-login error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
