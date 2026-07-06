import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getDbClient } from '@/lib/supabase-api';

export async function DELETE(req: Request) {
  try {
    const supabase = await getDbClient(req);
    
    // Get the authenticated user making the request
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Attempt to delete the user using the Admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Erro ao deletar usuário:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Because of ON DELETE CASCADE in the database, 
    // leads, settings, whatsapp_chats, and whatsapp_messages for this user_id will automatically be deleted.

    return NextResponse.json({ success: true, message: 'Conta excluída com sucesso' });
  } catch (error: any) {
    console.error("Internal API error deleting account:", error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
