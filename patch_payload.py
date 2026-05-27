import json
import re

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'r') as f:
    content = f.read()

def fix_json(fluxo_json_str):
    fluxo = json.loads(fluxo_json_str)
    for node in fluxo['nodes']:
        if node['name'].startswith('Evolution API'):
            # It's an HTTP request node. Update jsonBody to have 'text' at root
            if 'Follow-up' in node['name']:
                node['parameters']['jsonBody'] = "={{ {\n  \"number\": \"55\" + $json.phone,\n  \"options\": {\n    \"delay\": 1200,\n    \"presence\": \"composing\"\n  },\n  \"text\": $json.ai_follow_up\n} }}"
            else:
                node['parameters']['jsonBody'] = "={{ {\n  \"number\": \"55\" + $json.phone,\n  \"options\": {\n    \"delay\": 1200,\n    \"presence\": \"composing\"\n  },\n  \"text\": $json.ai_message\n} }}"
            
        elif node['name'].startswith('Deu Certo'):
            # Simplify IF node condition to correctly handle errors
            node['parameters']['conditions'] = {
                "string": [
                    {
                        "value1": "={{ $json.error ? 'error' : 'success' }}",
                        "operation": "equals",
                        "value2": "success"
                    }
                ]
            }
            if 'combineOperation' in node['parameters']:
                del node['parameters']['combineOperation']
            
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

print("Patch applied")
