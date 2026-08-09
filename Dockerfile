FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY reverse-ai-studio/package*.json ./
RUN npm ci
COPY reverse-ai-studio/ ./
ARG VITE_API_URL=/api/v1
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build


FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libpq5 curl \
    tesseract-ocr tesseract-ocr-vie tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Copy built frontend into static dir served by FastAPI
COPY --from=frontend-builder /app/frontend/dist/ ./backend/static/

WORKDIR /app/backend

EXPOSE 8000

CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
