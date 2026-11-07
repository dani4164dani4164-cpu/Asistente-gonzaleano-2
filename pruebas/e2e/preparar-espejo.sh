#!/usr/bin/env bash
# Prepara un ESPEJO LOCAL de las librerías y del modelo para correr las
# pruebas de extremo a extremo sin depender de jsDelivr ni de Hugging Face
# (útil en entornos de CI o contenedores con red restringida).
#   - Librerías: se bajan del registro de npm (jsDelivr sirve esos mismos archivos).
#   - Modelo: de huggingface.co, o copiado de MODELO_DIR si ya lo tienes local
#     (config.json, tokenizer.json, tokenizer_config.json, special_tokens_map.json,
#      model_quantized.onnx de Xenova/multilingual-e5-small).
# Uso: ESPEJO=/ruta/espejo [MODELO_DIR=/ruta/modelo] bash pruebas/e2e/preparar-espejo.sh
set -euo pipefail
ESPEJO=${ESPEJO:?Define ESPEJO=/ruta/al/espejo}
TMP=$(mktemp -d)
npm_pkg() { # paquete version destino
  local nombre=$1 version=$2 base; base=$(basename "$nombre")
  curl -fsSL "https://registry.npmjs.org/$nombre/-/$base-$version.tgz" | tar xz -C "$TMP" && mv "$TMP/package" "$3"
}
CDN="$ESPEJO/cdn.jsdelivr.net/npm"
mkdir -p "$CDN"
[ -d "$CDN/three@0.170.0" ] || npm_pkg three 0.170.0 "$CDN/three@0.170.0"
[ -d "$CDN/jszip@3.10.1" ] || npm_pkg jszip 3.10.1 "$CDN/jszip@3.10.1"
[ -d "$CDN/@huggingface/transformers@3.8.1" ] || { mkdir -p "$CDN/@huggingface"; npm_pkg @huggingface/transformers 3.8.1 "$CDN/@huggingface/transformers@3.8.1"; }
# jsDelivr genera «/+esm» al vuelo; aquí se imita envolviendo la versión UMD.
{ echo 'const module={exports:{}};const exports=module.exports;'; cat "$CDN/jszip@3.10.1/dist/jszip.min.js"; echo; echo 'export default module.exports;'; } > "$CDN/jszip@3.10.1/+esm"
HF="$ESPEJO/huggingface.co/Xenova/multilingual-e5-small/resolve/main"
mkdir -p "$HF/onnx"
for f in config.json tokenizer.json tokenizer_config.json special_tokens_map.json; do
  if [ -n "${MODELO_DIR:-}" ]; then cp "$MODELO_DIR/$f" "$HF/$f"; else curl -fsSL "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/$f" -o "$HF/$f"; fi
done
if [ -n "${MODELO_DIR:-}" ]; then cp "$MODELO_DIR/model_quantized.onnx" "$HF/onnx/model_quantized.onnx"
else curl -fsSL "https://huggingface.co/Xenova/multilingual-e5-small/resolve/main/onnx/model_quantized.onnx" -o "$HF/onnx/model_quantized.onnx"; fi
# Certificado autofirmado para servir esos dominios en 127.0.0.1
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=espejo-agios" \
  -addext "subjectAltName=DNS:cdn.jsdelivr.net,DNS:huggingface.co" \
  -keyout "$ESPEJO/clave.pem" -out "$ESPEJO/cert.pem" 2>/dev/null
rm -rf "$TMP"
echo "Espejo listo en $ESPEJO"
