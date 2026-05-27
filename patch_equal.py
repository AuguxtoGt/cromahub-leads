import json
import re

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'r') as f:
    content = f.read()

# Replace "equals" with "equal"
content = content.replace('"operation": "equals"', '"operation": "equal"')

with open('/Users/gustavoaugusto/.gemini/antigravity-ide/brain/d30370d2-d171-40eb-a1a5-e9400880018d/n8n_workflows.md', 'w') as f:
    f.write(content)

print("Patch applied for 'equal'")
