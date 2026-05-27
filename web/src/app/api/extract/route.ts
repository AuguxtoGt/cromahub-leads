import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Função auxiliar para esperar
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function POST(req: Request) {
  try {
    const { keyword, location, filterNoWebsite } = await req.json();
    
    if (!keyword || !location) {
      return NextResponse.json({ error: 'Palavra-chave e localização são obrigatórios' }, { status: 400 });
    }

    const textQuery = `${keyword} em ${location}`;
    
    let processedCount = 0;
    let apiCalls = 0;
    const insertedLeads = [];
    const TARGET_LEADS = 100;
    const MAX_API_CALLS = 30; // Aumentado para cobrir múltiplas zonas
    
    // O Segredo: Variações automáticas de região para burlar o limite de 60 resultados do Google
    const autoRegions = [
      "", // Busca geral primeiro
      "Centro",
      "Zona Sul",
      "Zona Norte",
      "Zona Leste",
      "Zona Oeste",
      "Bairros nobres"
    ];

    // Loop das regiões (faz isso sozinho para o usuário)
    for (const region of autoRegions) {
      if (processedCount >= TARGET_LEADS || apiCalls >= MAX_API_CALLS) break;

      // Monta a query inteligente
      const textQuery = region 
        ? `${keyword} ${region} em ${location}` 
        : `${keyword} em ${location}`;

      let pageToken = undefined;

      // Loop da paginação dentro daquela região
      while (true) {
        if (processedCount >= TARGET_LEADS || apiCalls >= MAX_API_CALLS) break;

        const apiResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY as string,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,nextPageToken',
          },
          body: JSON.stringify({
            textQuery,
            pageSize: 20,
            pageToken: pageToken
          })
        });

        if (!apiResponse.ok) {
          console.error('Google API Error:', await apiResponse.text());
          break; // Pula para a próxima região se der erro
        }

        const data = await apiResponse.json();
        const places = data.places || [];

        // Processar e Salvar no Supabase
        for (const place of places) {
          if (processedCount >= TARGET_LEADS) break;

          let hasWebsite = !!place.websiteUri;
          
          // Filtro Inteligente: Se o site for só um link de WhatsApp (ou Instagram/Facebook), consideramos que NÃO tem site próprio.
          if (hasWebsite) {
            const url = place.websiteUri.toLowerCase();
            if (
              url.includes('wa.me') || 
              url.includes('api.whatsapp') || 
              url.includes('chat.whatsapp') ||
              url.includes('instagram.com') ||
              url.includes('facebook.com')
            ) {
              hasWebsite = false; 
            }
          }

          if (filterNoWebsite && hasWebsite) continue;

          const leadData = {
            place_id: place.id,
            name: place.displayName?.text || 'Sem nome',
            formatted_address: place.formattedAddress,
            phone: place.internationalPhoneNumber || null,
            website: place.websiteUri || null,
            has_website: hasWebsite,
            rating: place.rating || null,
            user_ratings_total: place.userRatingCount || null,
            types: place.types || [],
            status: 'RAW'
          };

          const { data: inserted, error } = await supabase
            .from('leads')
            .upsert(leadData, { onConflict: 'place_id' })
            .select()
            .single();

          if (!error && inserted) {
            insertedLeads.push(inserted);
            processedCount++;
          }
        }

        apiCalls++;

        // Se acabaram as páginas DESSA região, quebra o while e vai pra próxima região
        if (!data.nextPageToken) {
          break;
        }

        pageToken = data.nextPageToken;
        await delay(2000); 
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Busca concluída em ${apiCalls} requisição(ões). Salvos/Atualizados: ${processedCount} leads.`,
      leads: insertedLeads
    });

  } catch (error: any) {
    console.error('Extraction Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
