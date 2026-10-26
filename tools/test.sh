#!/bin/sh
# Roda os testes do "npm test" um por um com o Electron ECS como Node e mostra só o resultado.
# Com Node instalado, "npm test" faz o mesmo.  Uso: sh tools/test.sh [trecho-do-nome]
R="$(cd "$(dirname "$0")/.." && pwd)"; cd "$R"
E="${RESENHA_NODE:-$R/../ecs-probe-20261024/runtime/electron.exe}"
fail=0
for t in $(grep -oE 'test/[a-z0-9.-]+\.js' package.json); do
  case "$t" in *"$1"*) ;; *) continue ;; esac
  if ELECTRON_RUN_AS_NODE=1 "$E" "$t" > /tmp/resenha-test.log 2>&1; then echo "ok    $t"; else echo "FALHA $t"; tail -5 /tmp/resenha-test.log; fail=1; fi
done
exit $fail
