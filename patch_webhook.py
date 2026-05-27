import json
import re

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'r') as f:
    content = f.read()

def fix_json(fluxo_json_str):
    fluxo = json.loads(fluxo_json_str)
    for node in fluxo['nodes']:
        if node['name'].startswith('Atualiza Status') or node['name'].startswith('Atualiza p/'):
            # It's a status update node. Update jsonBody to JS object expression
            if 'FAILED' in node['name']:
                node['parameters']['jsonBody'] = "={{ {\n  \"lead_id\": $('Loop (1 por vez)').item.json.id,\n  \"success\": false,\n  \"error_message\": $json.error?.message || $json.message || JSON.stringify($json)\n} }}"
            else:
                node['parameters']['jsonBody'] = "={{ {\n  \"lead_id\": $('Loop (1 por vez)').item.json.id,\n  \"success\": true\n} }}"
            
    return json.dumps(fluxo, indent=2)

# Patch Fluxo 1
match1 = re.search(r'## Código do Fluxo 1.*?```json\n(.*?)\n```', content, re.DOTALL)
if match1:
    content = content.replace(match1.group(1), fix_json(match1.group(1)))

# Patch Fluxo 2
match2 = re.search(r'## Código do Fluxo 2.*?```json\n(.*?)\n```', content, re.DOTALL)
if match2:
    content = content.replace(match2.group(1), fix_json(match2.group(1)))

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'w') as f:
    f.write(content)

print("Patch applied for webhook evaluation")
