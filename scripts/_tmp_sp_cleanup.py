import re
path = r'e:\Curser\cosmos\src\public\js\storepilot-prototype.js'
with open(path, 'r', encoding='utf-8') as f:
    s = f.read()
s = re.sub(
    r'\nwindow\.setIncFilter = function \(status\) \{[\s\S]*?\n\};\n\nwindow\.loadIncomingTransfers = async function \(\) \{[\s\S]*?\n\};\n',
    '\n',
    s,
    count=1,
)
s = re.sub(
    r'\n// Incoming Transfers badge on startup[\s\S]*?window\.expandSpMlDoc = async function \(docId\) \{[\s\S]*?\n\};\n',
    '\n',
    s,
    count=1,
)
s = s.replace('loadIncomingTransfers()', 'spRefreshAfterIncomingAction()')
with open(path, 'w', encoding='utf-8') as f:
    f.write(s)
print('done')
