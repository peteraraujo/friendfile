FROM python:3.11-slim

ENV DEBUG False
ENV CLIENT_BASE_PATH "/friendfile"
ENV API_BASE_PATH "/friendfile/api"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App files
COPY app.py .
COPY templates/ templates/
COPY static/css/*.min.css static/css/
COPY static/js/*.min.js static/js/
COPY static/favicon.svg static/
EXPOSE 5000

VOLUME ["/data"]

CMD ["python", "app.py"]
