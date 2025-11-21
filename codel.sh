docker run \
  -e OLLAMA_MODEL=minimax-m2:cloud \
  -e OLLAMA_SERVER_URL=127.0.0.1:11434 \
  -p 3000:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -d \
  ghcr.io/semanser/codel:latest \
