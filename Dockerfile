# Static app: nginx just serves the files.
FROM nginx:1.27-alpine
COPY index.html app.js srs.js style.css /usr/share/nginx/html/
COPY lessons/ /usr/share/nginx/html/lessons/
COPY kanji/ /usr/share/nginx/html/kanji/
