FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies and Zulu 21 OpenJDK
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && \
    # Add Azul Systems GPG key
    curl -fsSL https://www.azul.com/files/AzurePublicKey.asc | gpg --dearmor -o /usr/share/keyrings/azul.gpg && \
    # Add Azul Systems repository
    echo "deb [signed-by=/usr/share/keyrings/azul.gpg] https://repos.azul.com/azure-only/zulu-apt/ubuntu jammy main" > /etc/apt/sources.list.d/zulu.list && \
    apt-get update && \
    # Install Zulu 21 OpenJDK
    apt-get install -y --no-install-recommends zulu21-jdk && \
    # Clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/zulu21
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Verify Java installation
RUN java -version && \
    javac -version

# Create container user and working directory (Pterodactyl standard)
RUN useradd -m -d /home/container container && \
    mkdir -p /home/container && \
    chown -R container:container /home/container

# Set working directory
WORKDIR /home/container

# Switch to container user
USER container

# Default command
CMD ["/bin/bash"]

