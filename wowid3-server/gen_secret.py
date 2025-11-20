#!/usr/bin/env python3
"""Generate a secure tracker secret"""
import secrets
import sys

secret = secrets.token_hex(32)
print(secret)

# Also save to file if requested
if len(sys.argv) > 1 and sys.argv[1] == '--save':
    with open('.tracker_secret', 'w') as f:
        f.write(secret)
    print(f"\nSecret saved to .tracker_secret", file=sys.stderr)

