import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
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
    request.nextUrl.pathname === '/api/auth/callback' ||
    request.nextUrl.pathname === '/api/debug-google'; // temporário para diagnóstico

  // API Key mechanism for n8n to call protected APIs without a browser session
  const hasValidApiKey = () => {
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.API_KEY;
    if (apiKey && authHeader && authHeader === `Bearer ${apiKey}`) {
      return true;
    }
    return false;
  };

  // Se não estiver logado e tentar acessar rota protegida
  if (!user && !isPublicRoute) {
    // Se for uma chamada de API, verificar API KEY
    if (request.nextUrl.pathname.startsWith('/api/')) {
      if (!hasValidApiKey()) {
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
