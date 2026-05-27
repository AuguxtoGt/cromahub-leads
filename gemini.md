# gemini.md - Constituição do Projeto (CromaHUB Leads)

## 1. Visão Geral e Identidade
**Marca e Propósito:** CromaHUB Leads — Prospecção inteligente de clientes em escala.
**Estrela Guia (Objetivo):** Criar uma máquina de aquisição de clientes 100% autônoma e resistente a falhas.

## 2. Regras Comportamentais e Arquiteturais
- **Confiabilidade Extrema:** Foco total em resiliência. Se a IA falhar, o sistema retenta. Se o WhatsApp cair ou atingir limite, a mensagem vai para uma fila de espera (enqueue).
  - **Design System:** Estética "Light" moderna (SaaS Dashboard), fundo branco/off-white, limpo, focado em dados e produtividade.
  - **Micro-interações:** Hover states, transições fluidas, "1:1 Pixel Perfect", eliminando o aspecto genérico.
  - **Componentes UI:** Tabela larga (estilo Fokys) com painel lateral (Slide-over estilo Marketprod) para detalhes do lead.
  - **Arquitetura (POPs):** Regras de negócio restritas em `.md`.
  - **Navegação (Next.js/Node):** Roteamento e decisão determinística.
  - **Ferramentas (n8n/Webhooks):** Executores assíncronos.

## 3. Esquemas de Dados (Data Schemas - "A Lei")

### A. Payload de Extração (Google Places → Banco de Dados)
```json
{
  "place_id": "ChIJC_o5h5tZzpQR3wH311c6s0c",
  "name": "Nome da Empresa",
  "formatted_address": "Av. Paulista, 1000 - Bela Vista, SP",
  "city": "São Paulo",
  "state": "SP",
  "phone": "+5511999999999",
  "website": "https://site.com.br",
  "has_website": true,
  "rating": 4.8,
  "user_ratings_total": 120,
  "types": ["restaurante", "food", "point_of_interest"],
  "status": "RAW" // RAW, ENRICHED, AI_PROCESSED
}
```

### B. Payload de Análise IA (Banco de Dados → OpenAI → Banco de Dados)
```json
{
  "lead_id": "uuid-do-banco",
  "gargalos_identificados": ["Site não responsivo", "Falta de presença no iFood"],
  "copy_gerada": "Olá! Vi que o [Nome] é muito bem avaliado (4.8), mas notei que o site de vocês pode ser melhorado para trazer mais clientes. Somos a CromaHUB...",
  "status_analise": "SUCCESS" // PENDING, SUCCESS, FAILED_RETRY
}
```

### C. Payload de Disparo (Painel → n8n → Meta WhatsApp / Email)
```json
{
  "lead_id": "uuid-do-banco",
  "phone_target": "+5511999999999",
  "message_body": "Texto gerado pela IA",
  "channel": "WHATSAPP", // WHATSAPP, EMAIL, BOTH
  "priority": "NORMAL",
  "status_envio": "QUEUED" // QUEUED, SENT, DELIVERED, READ, FAILED
}
```
