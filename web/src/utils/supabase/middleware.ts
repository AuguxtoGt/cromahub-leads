import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não configuradas.');
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPublicRoute = 
    request.nextUrl.pathname.startsWith('/login') || 
    request.nextUrl.pathname.startsWith('/api/webhooks') ||
    request.nextUrl.pathname.startsWith('/auth/callback') ||
    request.nextUrl.pathname.startsWith('/auth/reset-password');


  // Intercepta auth code da url (ex: convite do supabase admin que cai no Site URL)
  if (request.nextUrl.searchParams.has('code') && !request.nextUrl.pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  // Intercepta token+type da url (fluxo de convite via Dashboard do Supabase)
  if (request.nextUrl.searchParams.has('token') && request.nextUrl.searchParams.has('type') && !request.nextUrl.pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  // API Key mechanism for n8n to call protected APIs without a browser session
  const hasValidApiKey = () => {
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.API_KEY;
    
    if (!apiKey || !authHeader) return false;
    
    const expected = `Bearer ${apiKey}`;
    
    // Constant-time string comparison to prevent timing attacks
    if (authHeader.length !== expected.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ authHeader.charCodeAt(i);
    }
    
    return result === 0;
  };

  // Se não estiver logado e tentar acessar rota protegida
  if (!user && !isPublicRoute) {
    // Se for uma chamada de API, verificar API KEY
    if (request.nextUrl.pathname.startsWith('/api/')) {
      if (!hasValidApiKey()) {
         const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
         await supabase.from('webhook_debug_log').insert({
           id: crypto.randomUUID(),
           event: 'security_alert',
           payload: JSON.stringify({
             reason: 'Invalid API_KEY',
             path: request.nextUrl.pathname,
             ip: ip
           }),
           created_at: new Date().toISOString()
         });
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      // É uma página do painel, redireciona para login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // Redirecionar usuário logado da página de login pro painel
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
