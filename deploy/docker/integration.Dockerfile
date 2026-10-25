# Kurum entegrasyonu (Python ACL) ve sahte GİB (demo/test) — aynı imaj, farklı komut.
# Playwright imajı tarayıcıları içerir (chromium-1248); Python paketi sürümü buna eşlenir.
FROM mcr.microsoft.com/playwright/python:v1.64.1-noble
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONPATH=/app/src:/app EWORKS_SOZLESMELER=/contracts
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir --break-system-packages \
      playwright==1.64.0 ddddocr==1.5.6 aio-pika==9.5.7 "psycopg[binary]==3.2.12" redis==6.4.0 boto3==1.40.61 pillow==11.3.0 \
      pytest==8.4.2 jsonschema==4.25.1 import-linter==2.5.2
# OCR modeli derlemede indirilir/yüklenir (çalışma anında dışarı istek yok)
RUN python3 -c "import ddddocr; ddddocr.DdddOcr(show_ad=False)"
COPY contracts /contracts
COPY services/integration /app
USER pwuser
CMD ["python3", "-m", "eworks_integration.core.calisan"]
