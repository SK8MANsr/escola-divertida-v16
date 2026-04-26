Atualização aplicada ao jogo da memória:

- As cartas do jogo da memória agora usam as imagens enviadas pelo usuário em vez dos emojis.
- Os arquivos foram adicionados em public/memory-cards/.
- O jogo monta o baralho por tema com imagens ilustradas.
- Há fallback automático para emojis se algum pool ficar sem imagens suficientes.

Como publicar:
1. Extraia este ZIP por cima da pasta do projeto.
2. Rode: npm install
3. Rode: npm run build
4. Rode: git add . && git commit -m "Atualiza cartas do jogo da memória" && git push
