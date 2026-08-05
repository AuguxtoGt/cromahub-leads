'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit } from '@/utils/rate-limit'

export async function login(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for') ?? 'anonymous'
  const rateLimit = await checkRateLimit(ip)
  if (!rateLimit.success) {
    redirect('/login?message=Too many requests. Please try again later.')
  }

  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect(`/login?message=${encodeURIComponent('E-mail ou senha inválidos')}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function register(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for') ?? 'anonymous'
  const rateLimit = await checkRateLimit(ip)
  if (!rateLimit.success) {
    redirect('/login?message=Too many requests. Please try again later.&tab=register')
  }

  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?message=Preencha+todos+os+campos&tab=register')
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}&tab=register`)
  }

  // Se tudo der certo, redireciona para home (o auth state mudará)
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function forgotPassword(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for') ?? 'anonymous'
  const rateLimit = await checkRateLimit(ip)
  if (!rateLimit.success) {
    redirect('/login?message=Too many requests. Please try again later.')
  }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://leads.cromahub.cloud';

  const email = formData.get('email') as string

  if (!email) {
    redirect(`/login?message=${encodeURIComponent('Informe o e-mail para recuperar a senha')}`)
  }

  // Verificar se o usuário existe gerando um link de recuperação via admin
  const { error: checkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email
  });

  if (checkError) {
    redirect(`/login?message=${encodeURIComponent('E-mail não encontrado no sistema')}`)
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  })

  if (error) {
    redirect(`/login?message=${encodeURIComponent('Erro ao enviar e-mail. Tente novamente.')}`)
  }

  redirect('/login?message=E-mail+enviado!+Verifique+sua+caixa+de+entrada.&type=success')
}
