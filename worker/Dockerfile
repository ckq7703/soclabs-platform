FROM python:3.11-slim

WORKDIR /app

# Install recon tools
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    unzip \
    golang-go \
    dnsutils \
    libpcap-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Go tools
ENV GOPATH=/root/go
ENV PATH=$PATH:$GOPATH/bin

RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@latest && \
    go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest && \
    go install -v github.com/owasp-amass/amass/v4/...@master && \
    go install -v github.com/tomnomnom/assetfinder@latest

# Update Nuclei templates
RUN nuclei -update-templates

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY recon_worker.py .

# Create results directory
RUN mkdir -p /data/results

CMD ["python3", "-u", "recon_worker.py"]
