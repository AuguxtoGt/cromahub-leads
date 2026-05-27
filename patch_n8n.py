import json
import re

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'r') as f:
    content = f.read()

# Extract Fluxo 1 JSON
match = re.search(r'## Código do Fluxo 1.*?```json\n(.*?)\n```', content, re.DOTALL)
fluxo1_json_str = match.group(1)
fluxo1 = json.loads(fluxo1_json_str)

# Modify Evolution API node
for node in fluxo1['nodes']:
    if node['name'] == 'Evolution API (Enviar Msg)':
        node['onError'] = 'continueErrorOutput'
        node['continueOnFail'] = True

# Add IF node
if_node = {
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
}

# Fix position of Atualiza Status p/ SENT
for node in fluxo1['nodes']:
    if node['name'] == 'Atualiza Status p/ SENT':
        node['position'] = [ 1500, 200 ]
        node['parameters']['jsonBody'] = '={\n  "lead_id": "{{ $(\'Loop (1 por vez)\').item.json.id }}",\n  "success": true\n}'

failed_node = {
    "parameters": {
        "method": "PATCH",
        "url": "https://leads.cromahub.cloud/api/queue-lead",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": '={\n  "lead_id": "{{ $(\'Loop (1 por vez)\').item.json.id }}",\n  "success": false,\n  "error_message": "{{ $json.error?.message || $json.message || JSON.stringify($json) }}"\n}',
        "options": {}
    },
    "name": "Atualiza Status p/ FAILED",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [ 1500, 400 ]
}

fluxo1['nodes'].append(if_node)
fluxo1['nodes'].append(failed_node)

# Update connections
conns = fluxo1['connections']
# Evolution -> Deu Certo?
conns['Evolution API (Enviar Msg)'] = {
    "main": [ [ { "node": "Deu Certo?", "type": "main", "index": 0 } ] ]
}
# Deu Certo? -> SENT (true), FAILED (false)
conns['Deu Certo?'] = {
    "main": [
        [ { "node": "Atualiza Status p/ SENT", "type": "main", "index": 0 } ],
        [ { "node": "Atualiza Status p/ FAILED", "type": "main", "index": 0 } ]
    ]
}
# SENT / FAILED -> Loop
conns['Atualiza Status p/ SENT'] = {
    "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ]
}
conns['Atualiza Status p/ FAILED'] = {
    "main": [ [ { "node": "Loop (1 por vez)", "type": "main", "index": 0 } ] ]
}

new_fluxo1_json_str = json.dumps(fluxo1, indent=2)
new_content = content.replace(fluxo1_json_str, new_fluxo1_json_str)

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'w') as f:
    f.write(new_content)

print("Patch applied successfully.")
