FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency requirements
COPY requirements.txt .

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 8000

ENV PORT=8000
ENV HOST=0.0.0.0

CMD ["python", "server.py"]
