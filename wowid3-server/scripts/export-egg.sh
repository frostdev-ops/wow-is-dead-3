#!/bin/bash
# Export/Import Pterodactyl Egg JSON utilities
# This script helps validate and format egg JSON files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

EGG_FILE="${1:-eggs/fabric-server.json}"

echo "=========================================="
echo "Pterodactyl Egg JSON Validator"
echo "=========================================="
echo "File: $EGG_FILE"
echo ""

# Check if file exists
if [ ! -f "$EGG_FILE" ]; then
    echo -e "${RED}ERROR: Egg file not found: $EGG_FILE${NC}"
    exit 1
fi

# Check if jq is available for JSON validation
if command -v jq &> /dev/null; then
    echo -e "${GREEN}Validating JSON structure...${NC}"
    
    # Validate JSON syntax
    if jq empty "$EGG_FILE" 2>/dev/null; then
        echo -e "${GREEN}✓ Valid JSON syntax${NC}"
    else
        echo -e "${RED}✗ Invalid JSON syntax${NC}"
        jq . "$EGG_FILE" 2>&1 | head -20
        exit 1
    fi
    
    # Check for required fields
    echo ""
    echo -e "${GREEN}Checking required fields...${NC}"
    
    REQUIRED_FIELDS=("name" "author" "description" "startup" "config")
    MISSING_FIELDS=()
    
    for field in "${REQUIRED_FIELDS[@]}"; do
        if jq -e ".$field" "$EGG_FILE" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $field${NC}"
        else
            echo -e "${RED}✗ Missing: $field${NC}"
            MISSING_FIELDS+=("$field")
        fi
    done
    
    if [ ${#MISSING_FIELDS[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}ERROR: Missing required fields: ${MISSING_FIELDS[*]}${NC}"
        exit 1
    fi
    
    # Display egg information
    echo ""
    echo "=========================================="
    echo "Egg Information"
    echo "=========================================="
    echo "Name: $(jq -r '.name' "$EGG_FILE")"
    echo "Author: $(jq -r '.author' "$EGG_FILE")"
    echo "Description: $(jq -r '.description' "$EGG_FILE")"
    
    # Check for docker_images (PTDL_v2) or docker_image (older format)
    if jq -e '.docker_images' "$EGG_FILE" > /dev/null 2>&1; then
        echo "Docker Images: $(jq -r '.docker_images | keys | join(", ")' "$EGG_FILE")"
    elif jq -e '.docker_image' "$EGG_FILE" > /dev/null 2>&1; then
        echo "Docker Image: $(jq -r '.docker_image' "$EGG_FILE")"
    fi
    
    echo "Format Version: $(jq -r '.meta.version // "PTDL_v1"' "$EGG_FILE")"
    echo ""
    echo "Variables: $(jq '.variables | length' "$EGG_FILE")"
    echo "Startup Command: $(jq -r '.startup' "$EGG_FILE")"
    
else
    echo -e "${YELLOW}WARNING: jq is not installed. JSON validation skipped.${NC}"
    echo "Install jq for JSON validation: sudo apt-get install jq"
    echo ""
    echo "Basic file check:"
    if file "$EGG_FILE" | grep -q "JSON"; then
        echo -e "${GREEN}✓ File appears to be JSON${NC}"
    else
        echo -e "${YELLOW}⚠ File type unclear${NC}"
    fi
fi

# Format JSON (if jq is available)
if command -v jq &> /dev/null; then
    echo ""
    read -p "Format JSON file? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Formatting JSON...${NC}"
        jq . "$EGG_FILE" > "$EGG_FILE.tmp" && mv "$EGG_FILE.tmp" "$EGG_FILE"
        echo -e "${GREEN}✓ JSON formatted${NC}"
    fi
fi

echo ""
echo "=========================================="
echo "Validation complete!"
echo "=========================================="
echo ""
echo "To import this egg into Pterodactyl:"
echo "1. Go to Admin Panel > Nests > [Your Nest]"
echo "2. Click 'Import Egg'"
echo "3. Upload or paste the contents of: $EGG_FILE"
echo ""
echo "Or use the Pterodactyl API to import programmatically."

