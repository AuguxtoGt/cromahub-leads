import json
import re

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'r') as f:
    content = f.read()

def fix_json(fluxo_json_str):
    fluxo = json.loads(fluxo_json_str)
    for node in fluxo['nodes']:
        if node['name'].startswith('Evolution API'):
            # It's an HTTP request node. Update jsonBody to be a JS object expression
            if 'Follow-up' in node['name']:
                node['parameters']['jsonBody'] = "={{ {\n  \"number\": \"55\" + $json.phone,\n  \"options\": {\n    \"delay\": 1200,\n    \"presence\": \"composing\"\n  },\n  \"textMessage\": {\n    \"text\": $json.ai_follow_up\n  }\n} }}"
            else:
                node['parameters']['jsonBody'] = "={{ {\n  \"number\": \"55\" + $json.phone,\n  \"options\": {\n    \"delay\": 1200,\n    \"presence\": \"composing\"\n  },\n  \"textMessage\": {\n    \"text\": $json.ai_message\n  }\n} }}"
            # And also connect Error branch
        elif node['name'].startswith('Deu Certo'):
            # It's the if node. The previous patch connected main output (index 0).
            # If the HTTP node uses continueErrorOutput, the error goes to index 1.
            # So we should connect both index 0 and index 1 of Evolution API to Deu Certo?
            pass
            
    # Update connections
    conns = fluxo['connections']
    for k, v in conns.items():
        if k.startswith('Evolution API'):
            # Connect both Success (0) and Error (1) outputs to Deu Certo?
            v['main'] = [
                [ { "node": "Deu Certo?", "type": "main", "index": 0 } ],
                [ { "node": "Deu Certo?", "type": "main", "index": 0 } ]
            ]
            
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
