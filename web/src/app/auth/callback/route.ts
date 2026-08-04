import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://leads.cromahub.cloud'
  const code = searchParams.get('code')
  const token = searchParams.get('token')
  const type = searchParams.get('type') // 'invite' | 'recovery' | 'signup' etc
  const next = searchParams.get('next') ?? '/auth/reset-password'

  const supabase = await createClient()

  // PKCE flow (resetPasswordForEmail, magic link com PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Token-based flow (convites e recuperação enviados pelo Supabase Dashboard)
  if (token && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'invite' | 'recovery' | 'signup' | 'email' | 'magiclink' | 'email_change' | 'sms',
    })

    if (!error) {
      // Invite and recovery should go to reset password page
      if (type === 'invite' || type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Se der erro, redireciona para login com mensagem
  return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent('Link inválido ou expirado. Solicite um novo convite.')}`)
}
