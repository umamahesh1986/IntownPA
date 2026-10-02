"""Launcher shim for the Emergent-managed environment.

The platform's supervisor is hard-coded to run `uvicorn server:app` on port 8001
and cannot be edited. The REAL IntownPA backend is a Node.js (Express) app.
Importing this module replaces the current process image with Node via exec(),
so Node ends up owning port 8001. Locally you can ignore this file and just run
`node index.js` (or `yarn start`) directly.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENTRY = os.path.join(HERE, "index.js")

# Replace this Python process with Node. exec never returns on success.
sys.stdout.write("[shim] handing off to Node.js backend...\n")
sys.stdout.flush()
os.execvp("node", ["node", ENTRY])
