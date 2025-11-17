#!/bin/bash
# Build and optionally push Docker image for Pterodactyl Fabric Server
# This script builds a Docker image with Zulu 21 Java

set -e

# Configuration
IMAGE_NAME="${IMAGE_NAME:-wowid3/fabric-server}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DOCKERFILE_PATH="${DOCKERFILE_PATH:-docker/Dockerfile}"
PUSH_IMAGE="${PUSH_IMAGE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Docker Image Builder"
echo "=========================================="
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo "Dockerfile: $DOCKERFILE_PATH"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE_PATH" ]; then
    echo -e "${RED}ERROR: Dockerfile not found at $DOCKERFILE_PATH${NC}"
    exit 1
fi

# Get the directory containing the Dockerfile
DOCKERFILE_DIR=$(dirname "$DOCKERFILE_PATH")

# Build the image
echo -e "${GREEN}Building Docker image...${NC}"
docker build \
    -t "$IMAGE_NAME:$IMAGE_TAG" \
    -f "$DOCKERFILE_PATH" \
    "$DOCKERFILE_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Image built successfully: $IMAGE_NAME:$IMAGE_TAG${NC}"
else
    echo -e "${RED}✗ Image build failed${NC}"
    exit 1
fi

# Optionally tag as latest
if [ "$IMAGE_TAG" != "latest" ]; then
    echo ""
    echo -e "${YELLOW}Tagging as latest...${NC}"
    docker tag "$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_NAME:latest"
    echo -e "${GREEN}✓ Tagged as latest${NC}"
fi

# Optionally push to registry
if [ "$PUSH_IMAGE" = "true" ]; then
    echo ""
    echo -e "${YELLOW}Pushing image to registry...${NC}"
    docker push "$IMAGE_NAME:$IMAGE_TAG"
    
    if [ "$IMAGE_TAG" != "latest" ]; then
        docker push "$IMAGE_NAME:latest"
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Image pushed successfully${NC}"
    else
        echo -e "${RED}✗ Image push failed${NC}"
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}To push the image, set PUSH_IMAGE=true:${NC}"
    echo "  PUSH_IMAGE=true ./scripts/build-docker.sh"
fi

echo ""
echo "=========================================="
echo "Build complete!"
echo "=========================================="
echo "Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "To use this image in Pterodactyl, update your egg JSON:"
echo "  \"docker_image\": \"$IMAGE_NAME:$IMAGE_TAG\""

