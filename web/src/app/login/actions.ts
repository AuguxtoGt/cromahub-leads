'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?message=E-mail+ou+senha+inválidos')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function register(formData: FormData) {
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

  // Se tudo der certo, redireciona para a home (o auth state mudará)
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const origin =
    headersList.get('origin') ||
    (headersList.get('host') ? `https://${headersList.get('host')}` : null) ||
    'https://leads.cromahub.cloud'

  const email = formData.get('email') as string

  if (!email) {
    redirect('/login?message=Informe+o+e-mail+para+recuperar+a+senha')
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  })

  if (error) {
    redirect('/login?message=Erro+ao+enviar+e-mail.+Tente+novamente.')
  }

  redirect('/login?message=E-mail+enviado!+Verifique+sua+caixa+de+entrada.&type=success')
}
