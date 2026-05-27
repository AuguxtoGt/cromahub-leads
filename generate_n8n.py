import json

fluxo1 = {
  "name": "CromaHub - Fluxo 1 (Disparo Inicial)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [ { "field": "cronExpression", "expression": "0 * * * *" } ]
        }
      },
      "name": "Gatilho (1 em 1 hora)",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [ 100, 300 ]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "https://leads.cromahub.cloud/api/queue-lead/batch?limit=20",
        "sendHeaders": True,
        "headerParameters": {
          "parameters": [ { "name": "Accept", "value": "application/json" } ]
        },
        "options": {}
      },
      "name": "Puxar Leads na Fila",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 300, 300 ]
    },
    {
      "parameters": {
        "fieldToSplitOut": "leads",
        "options": {}
      },
      "name": "Separar Leads em Itens",
      "type": "n8n-nodes-base.itemLists",
      "typeVersion": 2.1,
      "position": [ 500, 300 ]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "name": "Loop (1 por vez)",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 2,
      "position": [ 700, 300 ]
    },
    {
      "parameters": {
        "amount": "={{ Math.floor(Math.random() * (12 - 4 + 1)) + 4 }}",
        "unit": "minutes"
      },
      "name": "Espera Randômica (4 a 12 min)",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1,
      "position": [ 900, 300 ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.cromahub.cloud/message/sendText/cromahub",
        "sendHeaders": True,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "SUA_CHAVE_EVOLUTION_AQUI" },
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "{\n  \"number\": \"55{{ $json.phone }}\",\n  \"options\": {\n    \"delay\": 1200,\n    \"presence\": \"composing\"\n  },\n  \"textMessage\": {\n    \"text\": \"{{ $json.ai_message }}\"\n  }\n}",
        "options": {}
      },
      "name": "Evolution API (Enviar Msg)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 1100, 300 ],
      "continueOnFail": True,
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.error ? 'error' : ($json.message ? 'error' : 'success') }}",
              "operation": "notEqual",
              "value2": "error"
            }
          ],
          "number": [
            {
              "value1": "={{ $response.statusCode }}",
              "operation": "smaller",
              "value2": 400
            }
          ]
        },
        "combineOperation": "any"
      },
      "name": "Deu Certo?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [ 1300, 300 ]
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "https://leads.cromahub.cloud/api/queue-lead",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "{\n  \"lead_id\": \"{{ $('Loop (1 por vez)').item.json.id }}\",\n  \"success\": true\n}",
        "options": {}
      },
      "name": "Atualiza Status p/ SENT",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 1500, 200 ]
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "https://leads.cromahub.cloud/api/queue-lead",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "{\n  \"lead_id\": \"{{ $('Loop (1 por vez)').item.json.id }}\",\n  \"success\": false,\n  \"error_message\": \"{{ $json.error?.message || $json.message || JSON.stringify($json) }}\"\n}",
        "options": {}
      },
      "name": "Atualiza Status p/ FAILED",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 1500, 400 ]
    }
  ],
  "connections": {
    "Gatilho (1 em 1 hora)": { "main": [ [ { "node": "Puxar Leads na Fila", "type": "main", "index": 0 } ] ] },
    "Puxar Leads na Fila": { "main": [ [ { "node": "Separar Leads em Itens", "type": "main", "index": 0 } ] ] },
    "Separar Leads em Itens": { "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ] },
    "Loop (1 por vez)": { "main": [ [ { "node": "Espera Randômica (4 a 12 min)", "type": "main", "index": 0 } ] ] },
    "Espera Randômica (4 a 12 min)": { "main": [ [ { "node": "Evolution API (Enviar Msg)", "type": "main", "index": 0 } ] ] },
    "Evolution API (Enviar Msg)": { "main": [ [ { "node": "Deu Certo?", "type": "main", "index": 0 } ] ] },
    "Deu Certo?": {
      "main": [
        [ { "node": "Atualiza Status p/ SENT", "type": "main", "index": 0 } ],
        [ { "node": "Atualiza Status p/ FAILED", "type": "main", "index": 0 } ]
      ]
    },
    "Atualiza Status p/ SENT": { "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ] },
    "Atualiza Status p/ FAILED": { "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ] }
  }
}

fluxo2 = {
  "name": "CromaHub - Fluxo 2 (Cão de Guarda / Follow-up)",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [ { "field": "cronExpression", "expression": "0 9 * * *" } ]
        }
      },
      "name": "Gatilho (Todo dia às 09h)",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [ 100, 300 ]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "https://leads.cromahub.cloud/api/follow-up?limit=20",
        "sendHeaders": True,
        "headerParameters": {
          "parameters": [ { "name": "Accept", "value": "application/json" } ]
        },
        "options": {}
      },
      "name": "Puxar Leads Atrasados (> 24h)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 300, 300 ]
    },
    {
      "parameters": {
        "fieldToSplitOut": "leads",
        "options": {}
      },
      "name": "Separar Leads",
      "type": "n8n-nodes-base.itemLists",
      "typeVersion": 2.1,
      "position": [ 500, 300 ]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "name": "Loop (1 por vez)",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 2,
      "position": [ 700, 300 ]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.ai_follow_up }}",
              "operation": "isNotEmpty"
            }
          ]
        }
      },
      "name": "Tem Mensagem de Follow-up?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [ 900, 300 ]
    },
    {
      "parameters": {
        "amount": "={{ Math.floor(Math.random() * (12 - 4 + 1)) + 4 }}",
        "unit": "minutes"
      },
      "name": "Espera Randômica (4 a 12 min)",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1,
      "position": [ 1100, 200 ]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.cromahub.cloud/message/sendText/cromahub",
        "sendHeaders": True,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "SUA_CHAVE_EVOLUTION_AQUI" },
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "{\n  \"number\": \"55{{ $json.phone }}\",\n  \"options\": {\n    \"delay\": 1200,\n    \"presence\": \"composing\"\n  },\n  \"textMessage\": {\n    \"text\": \"{{ $json.ai_follow_up }}\"\n  }\n}",
        "options": {}
      },
      "name": "Evolution API (Enviar Follow-up)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 1300, 200 ],
      "continueOnFail": True,
      "onError": "continueErrorOutput"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.error ? 'error' : ($json.message ? 'error' : 'success') }}",
              "operation": "notEqual",
              "value2": "error"
            }
          ],
          "number": [
            {
              "value1": "={{ $response.statusCode }}",
              "operation": "smaller",
              "value2": 400
            }
          ]
        },
        "combineOperation": "any"
      },
      "name": "Deu Certo?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [ 1500, 200 ]
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "https://leads.cromahub.cloud/api/follow-up",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "{\n  \"lead_id\": \"{{ $('Loop (1 por vez)').item.json.id }}\",\n  \"success\": true\n}",
        "options": {}
      },
      "name": "Atualiza p/ FOLLOW_UP_SENT",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 1700, 100 ]
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "https://leads.cromahub.cloud/api/follow-up",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "{\n  \"lead_id\": \"{{ $('Loop (1 por vez)').item.json.id }}\",\n  \"success\": false,\n  \"error_message\": \"{{ $json.error?.message || $json.message || JSON.stringify($json) }}\"\n}",
        "options": {}
      },
      "name": "Atualiza p/ FAILED",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [ 1700, 300 ]
    }
  ],
  "connections": {
    "Gatilho (Todo dia às 09h)": { "main": [ [ { "node": "Puxar Leads Atrasados (> 24h)", "type": "main", "index": 0 } ] ] },
    "Puxar Leads Atrasados (> 24h)": { "main": [ [ { "node": "Separar Leads", "type": "main", "index": 0 } ] ] },
    "Separar Leads": { "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ] },
    "Loop (1 por vez)": { "main": [ [ { "node": "Tem Mensagem de Follow-up?", "type": "main", "index": 0 } ] ] },
    "Tem Mensagem de Follow-up?": {
      "main": [
        [ { "node": "Espera Randômica (4 a 12 min)", "type": "main", "index": 0 } ],
        [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ]
      ]
    },
    "Espera Randômica (4 a 12 min)": { "main": [ [ { "node": "Evolution API (Enviar Follow-up)", "type": "main", "index": 0 } ] ] },
    "Evolution API (Enviar Follow-up)": { "main": [ [ { "node": "Deu Certo?", "type": "main", "index": 0 } ] ] },
    "Deu Certo?": {
      "main": [
        [ { "node": "Atualiza p/ FOLLOW_UP_SENT", "type": "main", "index": 0 } ],
        [ { "node": "Atualiza p/ FAILED", "type": "main", "index": 0 } ]
      ]
    },
    "Atualiza p/ FOLLOW_UP_SENT": { "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ] },
    "Atualiza p/ FAILED": { "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ] }
  }
}

md_content = f"""# Passo a Passo: Como importar os fluxos no n8n

O n8n possui uma funcionalidade "secreta" genial: qualquer código JSON de fluxo copiado para a área de transferência pode ser colado diretamente na tela branca (canvas) e ele monta todas as caixinhas pra você.

## O que você precisa fazer:

### Para o Fluxo 1 (Máquina de Disparo):
1. No seu n8n, abra a pasta `cromahub-leads` e clique no botão laranja **Create workflow** (no canto superior direito).
2. Na página do código abaixo (Fluxo 1), clique no botão de **Copiar** que aparece no canto superior direito do bloco de código.
3. Volte para o n8n, clique em qualquer espaço vazio na tela com as "bolinhas" de fundo e aperte **Ctrl + V** (ou Cmd + V no Mac). As caixas vão se montar sozinhas.
4. Salve o fluxo com o nome "Fluxo 1 - Disparo Inicial".

### Para o Fluxo 2 (Cão de Guarda / Follow-up):
1. Repita o processo: crie outro workflow limpo no n8n.
2. Copie o bloco de código do **Fluxo 2** abaixo.
3. Cole na tela em branco do n8n com **Ctrl + V**.
4. Salve o fluxo com o nome "Fluxo 2 - Follow-up 24h".

> [!IMPORTANT]
> **Toque Final:** Em ambos os fluxos, dê um duplo-clique no último nó chamado **"Evolution API (Enviar...)"**, clique no campo Header "apikey" e cole a sua chave da Evolution API onde está escrito `SUA_CHAVE_EVOLUTION_AQUI`. E não se esqueça de ativar a chavinha "Active" no canto superior direito de cada fluxo para que eles comecem a rodar no automático!

---

## Código do Fluxo 1 (Máquina de Disparo Inicial)
*Copie todo o bloco de código abaixo.*

```json
{json.dumps(fluxo1, indent=2)}
```

---

## Código do Fluxo 2 (Cão de Guarda / Follow-up 24h)
*Copie todo o bloco de código abaixo.*

```json
{json.dumps(fluxo2, indent=2)}
```
"""

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'w') as f:
    f.write(md_content)

