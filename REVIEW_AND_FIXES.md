# Revisão geral e correções aplicadas

## Problemas encontrados

1. **Camada de sincronização pouco resiliente**
   - `cloudSync.ts` e `dynamicContent.ts` assumiam sempre resposta JSON válida.
   - Em falha de rede, HTML de erro ou status não-200, a UI podia cair em exceções de parse.

2. **Restauração manual da nuvem incompleta**
   - O download manual restaurava apenas perfis, progresso, uso e histórico.
   - Ficavam de fora `dailyMissionMap`, `onboardingSeen`, `seasonClaims` e `contentManifestVersion`.

3. **Carga inicial da nuvem sem normalização suficiente**
   - O payload remoto era aplicado quase “cru”, sem normalização completa do progresso e de configurações.
   - Isso aumentava o risco de incompatibilidade com saves antigos ou parciais.

4. **Persistência local vulnerável a falha de quota/privacidade**
   - `localStorage.setItem` e geração de `deviceId` podiam lançar erro em ambientes restritivos.

5. **Build de deploy não validava tipagem antes de publicar**
   - O Netlify estava configurado para apenas `npm run build`.

6. **Dependência com vulnerabilidade conhecida**
   - `vite@7.2.4` apresentava advisories abertas.

7. **`build.log` inconsistente**
   - O arquivo embutido no projeto ainda refletia uma build antiga da V7.

## Correções aplicadas

- Adicionado parsing resiliente e tratamento de falha de rede em:
  - `src/lib/cloudSync.ts`
  - `src/lib/dynamicContent.ts`
- Tornado `src/lib/storage.ts` tolerante a exceções de `localStorage`.
- Criada normalização centralizada do payload remoto em `src/App.tsx`.
- Corrigida a restauração manual da nuvem para recuperar também:
  - missões do dia
  - onboarding visto
  - resgates de temporada
  - versão do catálogo
- Ajustado carregamento inicial da nuvem para aplicar o payload já normalizado.
- Adicionado script `build:ci` em `package.json`.
- Alterado `netlify.toml` para usar `npm run build:ci`.
- Atualizado `vite` para `7.3.2`.
- Regenerado `build.log` com a validação atual.
- Atualizado `README.md` para refletir o fluxo correto de validação/deploy.

## Validação executada

- `npm install`
- `npm run typecheck`
- `npm run build`
- `npm audit` → **0 vulnerabilidades**
- Smoke tests das Netlify Functions:
  - `cloud-save`
  - `content-catalog`
  - `content-admin`
- SSR smoke render por bundle dedicado (renderização do app em string) para detectar falhas críticas de runtime no carregamento inicial.

## Estado final

Projeto atualizado, validado e pronto para deploy estático no Netlify, com funções preparadas para Supabase e fallback local preservado.


## V14 pre-infra premium
- Added protected parent confirmation modal for restore/reset/publish.
- Added toast feedback system.
- Added smart variety recommendation and daily bonus star for underplayed world.
- Improved sound/touch baseline and celebration actions.
- Prepared variety bonus claims for future cloud sync.
