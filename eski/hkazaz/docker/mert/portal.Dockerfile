# Eworks portalı ve yerel köprü (yerel-sunucu.py). Build bağlamı: depo kökü
# GİB robotu (Playwright, görünür Chrome) bilerek kurulmaz: ekransız container'da
# kullanıcı CAPTCHA giremez. "Bilgileri Güncelle" bu yüzden "robot hazır değil" der.
FROM python:3.13-slim
RUN pip install --no-cache-dir "xlrd>=2,<3" "requests>=2,<3"
COPY mert/eworks/Eworks-Portal /src/Eworks-Portal
COPY mert/eworks/Eworks-Python-Robot /src/Eworks-Python-Robot
COPY hkazaz/docker/mert/run_portal.py /run_portal.py
EXPOSE 8765
CMD ["python", "-u", "/run_portal.py"]
