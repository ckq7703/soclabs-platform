import sys
import json
from unittest.mock import MagicMock

# Mock dependencies before import
sys.modules['redis'] = MagicMock()
sys.modules['psycopg2'] = MagicMock()
sys.modules['psycopg2.extras'] = MagicMock()

import os
# Set dummy env vars
os.environ['REDIS_HOST'] = 'localhost'
os.environ['POSTGRES_HOST'] = 'localhost'
os.environ['POSTGRES_PASSWORD'] = 'dummy'
os.environ['API_KEY'] = 'dummy'

# Import app
# Assuming this script is run from the directory containing main.py or parent
# We will run it from gateway/ directory
from main import app

# Generate schema
schema = app.openapi()
output_file = 'openapi.json'

with open(output_file, 'w') as f:
    json.dump(schema, f, indent=2)

print(f"OpenAPI schema generated at {os.path.abspath(output_file)}")
