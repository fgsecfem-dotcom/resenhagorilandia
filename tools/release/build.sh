#!/bin/sh
# Gera todos os pacotes da versão que está no package.json, sem publicar nada.
# Uso (Git Bash, a partir de qualquer pasta): sh work/resenhaapp/tools/release/build.sh
# Saída: outputs/releases-<versão>/ com 8 arquivos (Windows, Mac apple/intel, Linux, SHA256SUMS e guias).
# Pré-requisitos em work/: electron-runtime, ecs-probe-20261024/runtime (Electron ECS 44.9.3),
# mac-runtimes, tooling/rcodesign e tooling/shims; Python com castlabs_evs logado na conta EVS.
set -e
T="$(cd "$(dirname "$0")" && pwd)"
R="$(cd "$T/../.." && pwd)"          # work/resenhaapp
WS="${RESENHA_WS:-$(cd "$R/../.." && pwd)}"
cd "$WS"
W="$(cygpath -w "$WS")"
V="$(sed -n 's/^  "version": "\(.*\)",$/\1/p' "$R/package.json" | head -1)"
N="$(echo "$V" | tr -d .)"
E="$WS/work/electron-runtime/electron.exe"
CLI="$W\\work\\resenhaapp\\node_modules\\electron-builder\\cli.js"
echo "Resenha $V"
[ -e "outputs/releases-$V" ] && { echo "outputs/releases-$V já existe; apague antes de gerar de novo."; exit 1; }

export PATH="$T/nodeshim:$WS/work/tooling/shims:$PATH" npm_config_cache="$W\\work\\npm-cache" \
  ELECTRON_BUILDER_CACHE="$W\\work\\builder-cache" CSC_IDENTITY_AUTO_DISCOVERY=false ELECTRON_NO_ASAR=1
rm -rf "work/build-release$N" "work/build-linux$N" "work/mac-build-$N"

echo "== Windows (Electron ECS, para o Spotify)"
ELECTRON_RUN_AS_NODE=1 "$E" "$T/eb-wrap.js" "$CLI" --projectDir work/resenhaapp --win dir --publish never \
  "--config.electronDist=$W\\work\\ecs-probe-20261024\\runtime" --config.electronVersion=44.9.3 \
  --config.npmRebuild=false "--config.directories.output=$W\\work\\build-release$N"
echo "== Linux"
ELECTRON_RUN_AS_NODE=1 "$E" "$T/eb-wrap.js" "$CLI" --projectDir work/resenhaapp --linux dir --x64 --publish never \
  --config.npmRebuild=false "--config.directories.output=$W\\work\\build-linux$N"

echo "== Assinatura EVS (Windows)"
D="work/build-release$N/win-unpacked"; rm -f "$D/electron.exe.sig"
python -m castlabs_evs.vmp --no-ask sign-pkg "$(cygpath -w "$D")"

echo "== Pacotes"
python "$T/package-win.py"
for s in prepare-mac-apps configure-mac-helpers materialize-mac-signing-aliases sign-mac-apps finalize-mac-signatures verify-mac-apps package-mac-apps; do
  echo "-- $s"; python "$T/mac/$s.py"
done
python "$T/package-linux.py"
ls -l "outputs/releases-$V"
