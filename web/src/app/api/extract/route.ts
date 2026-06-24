import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';
import { checkRateLimit } from '@/utils/rate-limit';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Função auxiliar para esperar
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkRateLimit(ip);
    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 });
    }

    const supabase = await getDbClient(req);

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

        const apiResponse: any = await fetch('https://places.googleapis.com/v1/places:searchText', {
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
          const errorBody = await apiResponse.text();
          console.error('Google API Error:', errorBody);
          
          let parsedError: any = {};
          try { parsedError = JSON.parse(errorBody); } catch {}
          
          const googleMessage = parsedError?.error?.message || errorBody;
          const googleStatus = parsedError?.error?.status || 'UNKNOWN';

          // Erros críticos: não adianta tentar outras regiões, retorna imediatamente
          if (apiResponse.status === 403 || apiResponse.status === 401 || apiResponse.status === 400) {
            return NextResponse.json({
              success: false,
              error: `❌ Erro na Google Places API: ${googleMessage}`,
              google_status: googleStatus,
              google_http_code: apiResponse.status,
              dicas: apiResponse.status === 403 ? [
                "1. Verifique se a 'Places API (New)' está habilitada no Google Cloud Console",
                "2. Confirme que o faturamento (billing) está ativo no projeto GCP",
                "3. Verifique se a chave API não possui restrições de HTTP Referrer (usar apenas restrição de IP para uso server-side)",
                "4. Confirme que a chave pertence ao mesmo projeto onde a API está habilitada"
              ] : []
            }, { status: 502 });
          }
          
          break; // Para outros erros (429, 5xx), pula para próxima região
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
    return NextResponse.json({ error: 'Erro interno durante a extração' }, { status: 500 });
  }
}
