## V16 Supabase Operacional + Admin Inicial

# Escola Divertida V16

Projeto React/Vite com 7 mundos jogáveis, 84 fases, packs por idade e tema, mapa infantil de progressão, recompensas, sons, missões do dia, temporadas/eventos, trilhas semanais para pais, cloud save opcional e catálogo dinâmico administrável por Netlify + Supabase.

## Rodar localmente

```bash
npm install
npm run dev
```

## Validação local

```bash
npm run typecheck
npm run build
```

## Deploy no Netlify

1. Suba este projeto em um repositório Git.
2. No Netlify, conecte o repositório.
3. O arquivo `netlify.toml` já define:
   - build command: `npm run build:ci`
   - publish directory: `dist`
   - functions directory: `netlify/functions`
4. Defina as variáveis de ambiente:
   - `VITE_ENABLE_CLOUD_SYNC=true` para progresso em nuvem
   - `VITE_ENABLE_DYNAMIC_CONTENT=true` para catálogo dinâmico
   - `SUPABASE_URL=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `CONTENT_ADMIN_TOKEN=...` para publicar conteúdo pelo estúdio admin

## Funções Netlify incluídas

- `/.netlify/functions/cloud-save` → salva/baixa progresso em nuvem
- `/.netlify/functions/content-catalog` → entrega packs, eventos e trilhas dinâmicas
- `/.netlify/functions/content-admin` → publica catálogo no Supabase
- `/.netlify/functions/infra-health` → verifica se Netlify/Supabase/admin estão prontos

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Rode o SQL em `supabase/schema.sql`.
3. Copie a URL do projeto e a Service Role Key para o Netlify.
4. O estúdio admin do app pode:
   - validar rascunho JSON
   - pré-visualizar localmente
   - exportar/importar pacote único JSON
   - publicar o catálogo para o Supabase
5. A base usa as tabelas:
   - `parent_saves`
   - `content_packs`
   - `content_pack_phases`
   - `seasonal_events`
   - `parent_weekly_tracks`

## Segurança

A leitura e escrita de progresso e catálogo passam por Netlify Functions, mantendo a Service Role Key fora do navegador. As tabelas podem permanecer fechadas ao público.

## Novidades da V16

- painel de infraestrutura com health check real para Netlify + Supabase
- estúdio de conteúdo com validação, importação, exportação, carga remota e publicação consistente do pacote JSON
- publicação administrativa com sincronização integral, histórico remoto e preparação de tabela de publicações
- manutenção do fallback local quando a nuvem ainda não estiver ativa

- carga remota do catálogo diretamente para o editor admin
- sincronização integral do catálogo, desativando itens removidos do rascunho
- tabela `catalog_publications` para histórico e manifesto remoto
- health check mais profundo para funções e tabelas essenciais
- build simplificada para deploy padrão Vite/Netlify
