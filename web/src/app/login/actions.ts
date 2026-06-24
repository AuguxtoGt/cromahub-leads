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
    redirect('/login?message=Could not authenticate user')
  }

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
