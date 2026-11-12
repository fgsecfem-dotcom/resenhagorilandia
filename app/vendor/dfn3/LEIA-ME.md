# Filtro de ruído DeepFilterNet3 (só no app de PC)

Arquivos de `@workadventure/noise-suppression` 0.2.0 (MIT, ver `LICENSE`), que empacota o
DeepFilterNet3 (modelo e motor de Hendrik Schröter, MIT ou Apache-2.0).
Usados em `app/client.js` (`loadDeepFilterNet`). O celular usa o RNNoise de `vendor/ns`, mais leve.
Escolhido por teste comparativo em 12/11/2026: melhor qualidade que RNNoise, GTCRN e DTLN em ventilador,
louça, TV, conversa ao fundo, digitação e porta.
